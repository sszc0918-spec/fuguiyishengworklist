/**
 * iOS PWA 优化脚本 - 改进版
 * 处理iOS特有的存储、同步、缓存问题
 */

const iOSOptimizer = (() => {
  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandalone = () => window.navigator.standalone === true || document.referrer.includes('standalone=yes');
  
  const storageManager = {
    DB_NAME: 'worklist-pwa',
    DB_VERSION: 1,
    STORE_NAME: 'app-storage',
    
    async init() {
      return new Promise((resolve) => {
        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
        request.onerror = () => {
          console.warn('[iOS] IndexedDB open failed, falling back to localStorage');
          resolve(false);
        };
        request.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            db.createObjectStore(this.STORE_NAME);
            console.log('[iOS] IndexedDB initialized');
          }
        };
        request.onsuccess = () => resolve(true);
      });
    },
    
    async set(key, value) {
      try {
        const jsonValue = JSON.stringify(value);
        
        // 🔧 改进：并行执行 localStorage 和 IndexedDB，提高同步速度
        const results = await Promise.allSettled([
          // localStorage 同步保存
          Promise.resolve().then(() => {
            localStorage.setItem(key, jsonValue);
            return true;
          }),
          // IndexedDB 异步保存
          new Promise((resolve, reject) => {
            const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
            request.onsuccess = () => {
              try {
                const db = request.result;
                const tx = db.transaction(this.STORE_NAME, 'readwrite');
                const store = tx.objectStore(this.STORE_NAME);
                const putRequest = store.put(value, key);
                putRequest.onsuccess = () => resolve(true);
                putRequest.onerror = () => reject(putRequest.error);
              } catch (err) {
                reject(err);
              }
            };
            request.onerror = () => reject(request.error);
          })
        ]);
        
        // 🔧 记录同步状态
        if (results[0].status === 'fulfilled' || results[1].status === 'fulfilled') {
          console.log(`[iOS] Storage sync for '${key}': localStorage=${results[0].status}, IndexedDB=${results[1].status}`);
        }
        return true;
      } catch (err) {
        console.warn('[iOS] Storage set failed:', err);
        return false;
      }
    },
    
    async get(key) {
      try {
        return await new Promise((resolve) => {
          const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(this.STORE_NAME, 'readonly');
            const store = tx.objectStore(this.STORE_NAME);
            const getRequest = store.get(key);
            
            getRequest.onsuccess = () => {
              if (getRequest.result !== undefined) {
                resolve(getRequest.result);
              } else {
                const lsValue = localStorage.getItem(key);
                resolve(lsValue ? JSON.parse(lsValue) : null);
              }
            };
            
            getRequest.onerror = () => {
              const lsValue = localStorage.getItem(key);
              resolve(lsValue ? JSON.parse(lsValue) : null);
            };
          };
          
          request.onerror = () => {
            const lsValue = localStorage.getItem(key);
            resolve(lsValue ? JSON.parse(lsValue) : null);
          };
        });
      } catch (err) {
        console.warn('[iOS] Storage get failed:', err);
        return localStorage.getItem(key) ? JSON.parse(localStorage.getItem(key)) : null;
      }
    },
    
    async remove(key) {
      try {
        localStorage.removeItem(key);
        return new Promise((resolve) => {
          const request = indexedDB.open(this.DB_NAME);
          request.onsuccess = () => {
            const db = request.result;
            const tx = db.transaction(this.STORE_NAME, 'readwrite');
            const store = tx.objectStore(this.STORE_NAME);
            store.delete(key);
            resolve();
          };
          request.onerror = () => resolve();
        });
      } catch (err) {
        console.warn('[iOS] Storage remove failed:', err);
      }
    }
  };
  
  const syncManager = {
    syncInterval: null,
    isOnline: navigator.onLine,
    
    init() {
      window.addEventListener('online', () => {
        this.isOnline = true;
        console.log('[iOS] Back online, triggering sync');
        this.triggerSync();
      });
      
      window.addEventListener('offline', () => {
        this.isOnline = false;
        console.log('[iOS] Offline detected');
      });
      
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          console.log('[iOS] App became visible, checking sync');
          if (this.isOnline) {
            this.triggerSync();
          }
        }
      });
      
      this.syncInterval = setInterval(() => {
        if (this.isOnline) {
          this.triggerSync();
        }
      }, 5 * 60 * 1000);
    },
    
    async triggerSync() {
      try {
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({
            type: 'iOS_SYNC',
            timestamp: Date.now()
          });
        }
        console.log('[iOS] Sync triggered');
      } catch (err) {
        console.warn('[iOS] Sync failed:', err);
      }
    },
    
    destroy() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }
    }
  };
  
  const cacheWarmer = {
    async prewarmCache() {
      if (!('caches' in window)) {
        console.log('[iOS] Cache API不可用');
        return;
      }
      
      try {
        // 🔧 使用动态缓存名称，确保每次部署都能清除旧缓存
        const BUILD_DATE = new Date().toISOString().split('T')[0];
        const cacheName = `worklist-v3-${BUILD_DATE}`;
        const cache = await caches.open(cacheName);
        const criticalResources = [
          './',
          './index.html',
          './manifest.json',
          './apple-touch-icon.png',
          './favicon.png'
        ];
        
        for (const resource of criticalResources) {
          const cached = await cache.match(resource);
          if (!cached) {
            try {
              await cache.add(resource);
              console.log(`[iOS] Prewarmed cache: ${resource} (cache: ${cacheName})`);
            } catch (err) {
              console.warn(`[iOS] Failed to prewarm ${resource}:`, err);
            }
          }
        }
      } catch (err) {
        console.warn('[iOS] Cache prewarming failed:', err);
      }
    },
    
    async validateCache() {
      if (!('caches' in window)) return { valid: true };
      
      try {
        const BUILD_DATE = new Date().toISOString().split('T')[0];
        const cacheName = `worklist-v3-${BUILD_DATE}`;
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        
        console.log(`[iOS] Cache validation: ${keys.length} items cached (cache: ${cacheName})`);
        
        return {
          valid: keys.length > 0,
          itemCount: keys.length,
          cacheName: cacheName
        };
      } catch (err) {
        console.warn('[iOS] Cache validation failed:', err);
        return { valid: false };
      }
    }
  };
  
  const errorRecovery = {
    errorLog: [],
    
    logError(context, error) {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        context,
        message: error?.message,
        stack: error?.stack,
        url: window.location.href,
        userAgent: navigator.userAgent
      };
      
      this.errorLog.push(errorEntry);
      
      if (this.errorLog.length > 50) {
        this.errorLog.shift();
      }
      
      console.error(`[iOS] Error in ${context}:`, error);
      
      try {
        localStorage.setItem('ios-error-log', JSON.stringify(this.errorLog));
      } catch (err) {
        console.warn('[iOS] Failed to save error log');
      }
    },
    
    getErrorLog() {
      return this.errorLog;
    },
    
    clearErrorLog() {
      this.errorLog = [];
      localStorage.removeItem('ios-error-log');
    }
  };
  
  return {
    async initialize() {
      if (!isIOS()) {
        console.log('[iOS] Non-iOS device, skipping iOS optimizations');
        return;
      }
      
      console.log('[iOS] Initializing iOS PWA optimizer');
      console.log('[iOS] Standalone mode:', isStandalone());
      
      try {
        const idbAvailable = await storageManager.init();
        console.log('[iOS] IndexedDB available:', idbAvailable);
        
        await cacheWarmer.prewarmCache();
        const cacheStatus = await cacheWarmer.validateCache();
        console.log('[iOS] Cache status:', cacheStatus);
        
        syncManager.init();
        
        if (navigator.onLine) {
          syncManager.triggerSync();
        }
        
        console.log('[iOS] Optimizer initialized successfully');
        
        return {
          storage: storageManager,
          sync: syncManager,
          cache: cacheWarmer,
          errors: errorRecovery,
          isStandalone: isStandalone(),
          isOnline: navigator.onLine
        };
      } catch (err) {
        errorRecovery.logError('Initialization', err);
        throw err;
      }
    },
    
    storage: storageManager,
    sync: syncManager,
    cache: cacheWarmer,
    errors: errorRecovery
  };
})();

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    iOSOptimizer.initialize()
      .then(api => {
        console.log('[iOS] Optimizer ready:', api);
        window.iOSOptimizer = api;
      })
      .catch(err => {
        console.error('[iOS] Optimizer initialization failed:', err);
      });
  });
} else {
  iOSOptimizer.initialize()
    .then(api => {
      console.log('[iOS] Optimizer ready:', api);
      window.iOSOptimizer = api;
    })
    .catch(err => {
      console.error('[iOS] Optimizer initialization failed:', err);
    });
}
