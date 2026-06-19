// Mappls (MapMyIndia) Web SDK loader.
// Loads the global `mappls` namespace exactly once.
const KEY = process.env.REACT_APP_MAPPLS_KEY;

let loaderPromise = null;

export function loadMappls() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.mappls && window.mappls.Map) return Promise.resolve(window.mappls);
  if (loaderPromise) return loaderPromise;

  loaderPromise = new Promise((resolve, reject) => {
    const cbName = `__mappls_cb_${Date.now()}`;
    window[cbName] = () => {
      if (window.mappls && window.mappls.Map) resolve(window.mappls);
      else reject(new Error("Mappls SDK loaded but global missing"));
    };
    const s = document.createElement("script");
    s.src = `https://apis.mappls.com/advancedmaps/api/${KEY}/map_sdk?layer=vector&v=3.0&callback=${cbName}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Mappls SDK"));
    document.head.appendChild(s);
  });
  return loaderPromise;
}
