import { useCallback, useRef } from 'react';

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';

export function useRazorpay() {
  const scriptLoadedRef = useRef(false);

  const loadScript = useCallback((): Promise<boolean> => {
    if (scriptLoadedRef.current && window.Razorpay) {
      return Promise.resolve(true);
    }

    return new Promise((resolve) => {
      const existingScript = document.querySelector(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
      if (existingScript) {
        scriptLoadedRef.current = true;
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = RAZORPAY_SCRIPT_URL;
      script.async = true;
      script.onload = () => {
        scriptLoadedRef.current = true;
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }, []);

  const openCheckout = useCallback(
    async (options: RazorpayOptions): Promise<RazorpayPaymentResponse | null> => {
      const loaded = await loadScript();
      if (!loaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load');
      }

      return new Promise((resolve) => {
        const rzp = new window.Razorpay!({
          ...options,
          handler: (response: RazorpayPaymentResponse) => {
            resolve(response);
          },
          modal: {
            ...options.modal,
            ondismiss: () => {
              options.modal?.ondismiss?.();
              resolve(null);
            },
          },
        });
        rzp.open();
      });
    },
    [loadScript]
  );

  return { openCheckout, loadScript };
}
