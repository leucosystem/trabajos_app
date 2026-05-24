import { useEffect, useRef, useState } from "react";
import "./App.css";
import FunTitle from "./components/FunTitle";
import JobForm from "./components/JobForm";
import JobsList from "./components/JobsList";
import HoursView from "./components/HoursView";
import SignaturePad from "./components/SignaturePad";
import Toast from "./components/Toast";
import Auth from "./components/Auth";
import DoorTransition from "./components/DoorTransition";
import { formatDateToInput } from "./utils/date";
import { generateJobPdf } from "./utils/jobPdf";
import { listJobs, removeJob, saveJob } from "./utils/jobsStore";
import { useAuth } from "./utils/useAuth";
import { loadJobsFromSupabase, saveJobToSupabase, deleteJobFromSupabase } from "./utils/jobsSupabaseStore";
import { supabase } from "./utils/supabaseClient";

const DRAFT_KEY = "trabajos-draft";

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function emptyFormData() {
  return {
    cliente: "",
    operario: "",
    operarioUserId: "",
    estado: "supervisar",
    fecha: "",
    descripcion: "",
    cantidad: "",
    unidad: "cantidad",
  };
}

/**
 * Componente principal de la aplicacion.
 * Gestiona formulario, listado local de trabajos y generacion opcional del PDF.
 */
export default function App() {
  const { user, profile, loading: authLoading, initialized, signUp, signIn, signOut, isAdmin } = useAuth();
  
  // Todos los hooks DEBEN estar antes de cualquier retorno condicional
  const draft = loadDraft();
  const [activeView, setActiveView] = useState("new");
  const [editingJobId, setEditingJobId] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [assignableUsers, setAssignableUsers] = useState([]);
  const [loadingAssignableUsers, setLoadingAssignableUsers] = useState(false);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [formData, setFormData] = useState({
    ...emptyFormData(),
    ...(draft?.formData || {}),
  });
  const [photos, setPhotos] = useState([]);
  const [signature, setSignature] = useState(draft?.signature || null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [toast, setToast] = useState(null);
  const [doorTransitionMode, setDoorTransitionMode] = useState(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const photosRef = useRef([]);
  const hasInitializedAuthRef = useRef(false);
  const wasAuthenticatedRef = useRef(false);

  // Cargar trabajos desde Supabase cuando el usuario inicia sesión
  // Carga aunque no haya perfil todavía (admin puede tardar en cargar)
  useEffect(() => {
    if (user) {
      loadJobs();
    }
  }, [user, profile]);

  // Guardar borrador
  useEffect(() => {
    const timeout = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ formData, signature }));
    }, 400);
    return () => clearTimeout(timeout);
  }, [formData, signature]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    const isAuthenticated = Boolean(user);

    if (!hasInitializedAuthRef.current) {
      hasInitializedAuthRef.current = true;
      wasAuthenticatedRef.current = isAuthenticated;
      return;
    }

    if (!wasAuthenticatedRef.current && isAuthenticated) {
      setDoorTransitionMode("opening");
      const timeout = setTimeout(() => {
        setDoorTransitionMode(null);
      }, 2000);
      wasAuthenticatedRef.current = true;
      return () => clearTimeout(timeout);
    }

    if (!isAuthenticated) {
      setDoorTransitionMode(null);
    }

    wasAuthenticatedRef.current = isAuthenticated;
  }, [user]);

  async function handleSignOutWithTransition() {
    if (isLoggingOut) return;

    setIsLoggingOut(true);
    setDoorTransitionMode("closing");

    setTimeout(async () => {
      const { error } = await signOut();
      if (error) {
        setDoorTransitionMode(null);
        setToast({ message: "Error al cerrar sesión", type: "error" });
        setIsLoggingOut(false);
        return;
      }

      setDoorTransitionMode(null);
      setIsLoggingOut(false);
    }, 820);
  }

  function getCurrentUserDisplayName() {
    return (
      profile?.full_name?.trim() ||
      user?.user_metadata?.full_name?.trim() ||
      "Sin nombre"
    );
  }

  function getCurrentUserShortName() {
    const fullName = getCurrentUserDisplayName();
    if (fullName && fullName !== "Sin nombre") {
      return fullName.split(" ")[0];
    }

    return user?.email?.split("@")[0] || "Usuario";
  }

  useEffect(() => {
    if (!user || isAdmin || editingJobId) return;

    const displayName = getCurrentUserDisplayName();
    setFormData((prev) => {
      if (prev.operario === displayName && prev.operarioUserId === user.id) {
        return prev;
      }
      return {
        ...prev,
        operario: displayName,
        operarioUserId: user.id,
      };
    });
  }, [user, profile, isAdmin, editingJobId]);

  useEffect(() => {
    if (!user || !isAdmin) {
      setAssignableUsers([]);
      setLoadingAssignableUsers(false);
      return;
    }

    let alive = true;

    async function loadAssignableUsers() {
      setLoadingAssignableUsers(true);
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, role")
          .order("full_name", { ascending: true });

        if (error) throw error;

        if (!alive) return;
        const users = (data || []).map((item) => ({
          id: item.id,
          label: `${item.full_name || "Sin nombre"}${item.role === "admin" ? " (Admin)" : ""}`,
        }));
        setAssignableUsers(users);
      } catch (err) {
        console.error("Error loading assignable users:", err);
        if (alive) {
          setAssignableUsers([]);
          setToast({ message: "No se pudieron cargar los usuarios", type: "error" });
        }
      } finally {
        if (alive) setLoadingAssignableUsers(false);
      }
    }

    loadAssignableUsers();
    return () => {
      alive = false;
    };
  }, [user, isAdmin]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  // NOW el early return, DESPUÉS de todos los hooks
  if (!initialized && authLoading && !user && !isLoggingOut) {
    return (
      <div className="app loading-container">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!user) {
    if (isLoggingOut && doorTransitionMode === "closing") {
      return (
        <div className="app" aria-hidden="true">
          <DoorTransition isOpen={false} />
        </div>
      );
    }

    return <Auth onSignUp={signUp} onSignIn={signIn} loading={authLoading} />;
  }

  async function loadJobs() {
    setLoadingJobs(true);
    try {
      const data = await loadJobsFromSupabase(user.id, isAdmin);
      setJobs(data);
    } catch (err) {
      console.error('Error loading jobs:', err);
      setToast({ message: 'Error al cargar trabajos', type: 'error' });
    } finally {
      setLoadingJobs(false);
    }
  }

  const isFormValid =
    formData.cliente.trim() !== "" &&
    formData.operario.trim() !== "" &&
    formData.operarioUserId.trim() !== "" &&
    formData.fecha.trim() !== "" &&
    formData.descripcion.trim() !== "" &&
    formData.cantidad.trim() !== "" &&
    Number(formData.cantidad) > 0 &&
    formData.unidad.trim() !== "";

  /** Actualiza un campo del formulario a partir del evento del input. */
  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  /** Maneja el cambio de cantidad, permitiendo solo numeros con un decimal. */
  function handleCantidadChange(event) {
    const rawValue = event.target.value.replace(",", ".");
    const isValid = /^\d*(\.\d{0,1})?$/.test(rawValue);
    if (!isValid) return;
    setFormData((prev) => ({ ...prev, cantidad: rawValue }));
  }

  /** Establece la fecha del formulario a hoy. */
  function setTodayDate() {
    setFormData((prev) => ({ ...prev, fecha: formatDateToInput(new Date()) }));
  }

  /** Agrega las fotos seleccionadas al estado, generando URLs de previsualizacion. */
  function handlePhotosChange(event) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const nextPhotos = selectedFiles.map((file) => ({
      id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      url: URL.createObjectURL(file),
      info: "",
    }));

    setPhotos((prev) => [...prev, ...nextPhotos]);
    event.target.value = "";
  }

  /** Elimina todas las fotos y libera sus URLs de memoria. */
  function clearPhotos() {
    setPhotos((prev) => {
      prev.forEach((photo) => URL.revokeObjectURL(photo.url));
      return [];
    });
  }

  /** Actualiza el texto informativo de una foto por su ID. */
  function handlePhotoInfoChange(photoId, value) {
    setPhotos((prev) => prev.map((photo) => (photo.id === photoId ? { ...photo, info: value } : photo)));
  }

  /** Elimina una foto por su ID y libera su URL de memoria. */
  function removePhoto(photoId) {
    setPhotos((prev) => {
      const photoToRemove = prev.find((photo) => photo.id === photoId);
      if (photoToRemove) URL.revokeObjectURL(photoToRemove.url);
      return prev.filter((photo) => photo.id !== photoId);
    });
  }

  /** Mueve una foto de una posicion a otra (para drag & drop). */
  function reorderPhotos(fromIndex, toIndex) {
    setPhotos((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function refreshJobs() {
    loadJobs();
  }

  function handleOperarioUserChange(selectedUserId) {
    const selectedUser = assignableUsers.find((item) => item.id === selectedUserId);
    const selectedLabel = selectedUser?.label || "";

    setFormData((prev) => ({
      ...prev,
      operarioUserId: selectedUserId,
      operario: selectedLabel.replace(/\s\(Admin\)$/, ""),
    }));
  }

  function resolveOperarioNameForPdf() {
    const explicitOperario = (formData.operario || "").trim();
    if (explicitOperario) return explicitOperario;

    if (isAdmin) {
      const selectedUser = assignableUsers.find((item) => item.id === formData.operarioUserId);
      const selectedLabel = (selectedUser?.label || "").replace(/\s\(Admin\)$/, "").trim();
      if (selectedLabel) return selectedLabel;
    }

    return getCurrentUserDisplayName();
  }

  function resetFormForNewJob() {
    clearPhotos();
    setFormData(emptyFormData());
    setSignature(null);
    setEditingJobId(null);
    localStorage.removeItem(DRAFT_KEY);
  }

  function startNewJob() {
    resetFormForNewJob();
    setActiveView("new");
  }

  async function persistCurrentJob() {
    try {
      const saved = await saveJobToSupabase({
        id: editingJobId,
        ...formData,
        signature,
        photoCount: photos.length,
        photoInfo: photos.map((photo) => photo.info || ""),
      }, user.id, isAdmin);

      refreshJobs();
      return saved;
    } catch (err) {
      if (err?.message === 'JOB_LOCKED_BY_STATUS') {
        setToast({ message: 'Este parte ya no se puede editar porque su estado no es Supervisar', type: 'error' });
      } else {
        setToast({ message: 'Error al guardar trabajo', type: 'error' });
      }
      console.error('Error persisting job:', err);
      return null;
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    if (!isFormValid || isGeneratingPdf) return;

    const saved = await persistCurrentJob();
    if (!saved) return;

    setToast({ message: editingJobId ? "Trabajo actualizado" : "Trabajo guardado", type: "success" });
    setActiveView("list");
  }

  function handleEditFromList(jobId) {
    const job = jobs.find((item) => item.id === jobId);
    if (!job) return;
    if ((job.estado || "supervisar") !== "supervisar") {
      setToast({ message: "Este parte no se puede editar porque ya no está en Supervisar", type: "error" });
      return;
    }

    clearPhotos();
    setEditingJobId(job.id);
    setFormData({
      cliente: job.cliente || "",
      operario: job.operario || "",
      operarioUserId: job.operarioUserId || job.user_id || "",
      estado: job.estado || "supervisar",
      fecha: job.fecha || "",
      descripcion: job.descripcion || "",
      cantidad: job.cantidad || "",
      unidad: job.unidad || "cantidad",
    });
    setSignature(job.signature || null);
    setActiveView("new");
  }

  function handleDeleteFromList(jobId) {
    deleteJobFromSupabase(jobId).then(() => {
      refreshJobs();
      setToast({ message: "Trabajo borrado", type: "success" });
    }).catch((err) => {
      setToast({ message: "Error al borrar trabajo", type: "error" });
      console.error('Error deleting job:', err);
    });
  }

  /** Abre el panel de firma, intentando poner pantalla completa y landscape en movil. */
  async function openSignaturePad() {
    try {
      await document.documentElement.requestFullscreen();
      await screen.orientation.lock("landscape");
    } catch (_) {
      // Si no soporta fullscreen/orientation lock, se firma en la orientacion actual
    }
    setShowSignaturePad(true);
  }

  /** Cierra el panel de firma y restaura la orientacion. */
  async function closeSignaturePad() {
    setShowSignaturePad(false);
    try {
      screen.orientation.unlock();
    } catch (_) {}
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  }

  /** Genera el PDF del parte de trabajo y gestiona el estado de carga. */
  async function handleGeneratePdf() {
    if (!isFormValid || isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      const operarioForPdf = resolveOperarioNameForPdf();
      const payloadForPdf = { ...formData, operario: operarioForPdf };

      const saved = await persistCurrentJob();
      if (!saved) return;

      await generateJobPdf({ formData: payloadForPdf, photos, signature });
      setToast({ message: "PDF generado correctamente", type: "success" });
      setActiveView("list");
    } catch {
      setToast({ message: "Error al generar el PDF", type: "error" });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <div className="app">
      <main className="app-main">
        <header className="app-header">
          <div className="header-top">
            <div className="header-identity">
              <FunTitle text="Trabajos" />
              <span className={`role-badge ${isAdmin ? "admin" : "user"}`}>
                {`${isAdmin ? "Admin" : "Usuario"} · ${getCurrentUserShortName()}`}
              </span>
            </div>
            <button 
              type="button" 
              className="logout-btn"
              onClick={handleSignOutWithTransition}
              disabled={isLoggingOut}
              title="Cerrar sesión"
            >
              {isLoggingOut ? "Cerrando..." : "Cerrar Sesión"}
            </button>
          </div>
          <p className="app-subtitle">
            Registro diario de trabajo {isAdmin && '(Administrador)'}
          </p>

          <div className="view-switch" role="tablist" aria-label="Cambiar vista">
            <button
              type="button"
              className={`secondary-btn view-btn ${activeView === "new" ? "active" : ""}`}
              onClick={() => setActiveView("new")}
            >
              Nuevo trabajo
            </button>
            <button
              type="button"
              className={`secondary-btn view-btn ${activeView === "list" ? "active" : ""}`}
              onClick={() => setActiveView("list")}
            >
              Trabajos
            </button>
            <button
              type="button"
              className={`secondary-btn view-btn ${activeView === "hours" ? "active" : ""}`}
              onClick={() => setActiveView("hours")}
            >
              Horas
            </button>
          </div>
        </header>

        {activeView === "new" ? (
          <JobForm
            formData={formData}
            photos={photos}
            signature={signature}
            isAdmin={isAdmin}
            assignableUsers={assignableUsers}
            isLoadingAssignableUsers={loadingAssignableUsers}
            isFormValid={isFormValid}
            isGeneratingPdf={isGeneratingPdf}
            isEditing={Boolean(editingJobId)}
            onSubmit={handleSave}
            onGeneratePdf={handleGeneratePdf}
            onCancelEdit={startNewJob}
            onChange={handleChange}
            onCantidadChange={handleCantidadChange}
            onOperarioUserChange={handleOperarioUserChange}
            onSetTodayDate={setTodayDate}
            onPhotosChange={handlePhotosChange}
            onClearPhotos={clearPhotos}
            onRemovePhoto={removePhoto}
            onReorderPhotos={reorderPhotos}
            onPhotoInfoChange={handlePhotoInfoChange}
            onRequestSignature={openSignaturePad}
            onClearSignature={() => setSignature(null)}
          />
        ) : activeView === "list" ? (
          <JobsList jobs={jobs} onEdit={handleEditFromList} onDelete={handleDeleteFromList} />
        ) : (
          <HoursView
            userId={user.id}
            isAdmin={isAdmin}
            assignableUsers={assignableUsers}
            isLoadingAssignableUsers={loadingAssignableUsers}
            onNotify={(message, type) => setToast({ message, type })}
          />
        )}
      </main>

      {showSignaturePad && (
        <SignaturePad
          onConfirm={(dataUrl) => {
            setSignature(dataUrl);
            closeSignaturePad();
          }}
          onCancel={closeSignaturePad}
        />
      )}

      {doorTransitionMode && <DoorTransition isOpen={doorTransitionMode === "opening"} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
