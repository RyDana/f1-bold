import * as THREE from 'three';
import { GradientPoint } from 'tweakpane-plugin-gradient';

export function autoSaveToLocalStorage<T extends object>(
  key: string,
  rootObject: T
) {
  const save = () => {
    localStorage.setItem(key, JSON.stringify(rootObject));
  };

  const handler = {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === 'object' && value !== null) {
        // Recursively wrap nested objects
        return createProxy(value, save);
      }
      return value;
    },
    set(target, prop, value, receiver) {
      const result = Reflect.set(target, prop, value, receiver);
      save(); // Save to localStorage whenever a property is set
      return result;
    },
    deleteProperty(target, prop) {
      const result = Reflect.deleteProperty(target, prop);
      save(); // Save to localStorage on property delete
      return result;
    },
  };

  // Cache proxies to avoid infinite recursion and preserve identity
  const proxyCache = new WeakMap();

  function createProxy(obj, saveCallback) {
    if (proxyCache.has(obj)) {
      return proxyCache.get(obj);
    }
    const proxy = new Proxy(obj, handler);
    proxyCache.set(obj, proxy);
    return proxy;
  }

  return createProxy(rootObject, save);
}

export function createGradientTexture(
  gradientStops: Array<{
    time: number;
    value: {
      r: number;
      g: number;
      b: number;
      a: number;
    };
  }>,
  resolution: number = 256
): THREE.DataTexture {
  const canvas = document.createElement('canvas');
  canvas.width = resolution;
  canvas.height = 1;
  const ctx = canvas.getContext('2d')!;

  // Create gradient
  const gradient = ctx.createLinearGradient(0, 0, resolution, 0);
  gradientStops.forEach((stop) => {
    gradient.addColorStop(
      stop.time,
      `rgba(${stop.value.r}, ${stop.value.g}, ${stop.value.b}, ${stop.value.a})`
    );
  });

  // Draw gradient to canvas
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, resolution, 1);

  // Extract pixel data
  const imageData = ctx.getImageData(0, 0, resolution, 1).data;
  const texture = new THREE.DataTexture(
    new Uint8Array(imageData),
    resolution,
    1,
    THREE.RGBAFormat
  );
  texture.needsUpdate = true;

  return texture;
}
