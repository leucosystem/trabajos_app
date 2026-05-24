import { useEffect, useState } from 'react';

/**
 * Hook para detectar cuando hay una nueva versión del Service Worker
 * Si hay actualización, muestra un toast pidiendo al usuario que recargue
 */
export function useServiceWorkerUpdate(onUpdateAvailable) {
  const [updatePending, setUpdatePending] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    let registration;

    const handleServiceWorkerUpdate = async () => {
      try {
        registration = await navigator.serviceWorker.getRegistration();

        if (!registration) return;

        // Busca actualizaciones cada 60 segundos
        const updateCheckInterval = setInterval(async () => {
          try {
            await registration.update();
          } catch (error) {
            console.error('Error checking for SW updates:', error);
          }
        }, 60000);

        // Escucha cuando hay un nuevo SW esperando
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;

          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // Hay un nuevo SW esperando para activarse
              setUpdatePending(true);
              if (onUpdateAvailable) {
                onUpdateAvailable();
              }
            }
          });
        });

        // Limpia el interval cuando se desmonta el componente
        return () => clearInterval(updateCheckInterval);
      } catch (error) {
        console.error('Error setting up SW update listener:', error);
      }
    };

    handleServiceWorkerUpdate();
  }, [onUpdateAvailable]);

  const reloadApp = () => {
    const registration = navigator.serviceWorker.controller;
    if (registration) {
      registration.postMessage({ type: 'SKIP_WAITING' });
    }
    // Recarga la página después de 1 segundo
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  return { updatePending, reloadApp };
}
