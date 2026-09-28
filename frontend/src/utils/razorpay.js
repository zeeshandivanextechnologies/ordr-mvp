// Loads Razorpay Checkout (https://checkout.razorpay.com/v1/checkout.js) once, on demand.
let loader = null;

export const loadRazorpay = () => {
  if (window.Razorpay) return Promise.resolve(true);
  if (loader) return loader;
  loader = new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      loader = null;
      resolve(false);
    };
    document.body.appendChild(script);
  });
  return loader;
};
