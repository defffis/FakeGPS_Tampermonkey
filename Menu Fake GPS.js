// ==UserScript==
// @name         Menu Fake GPS
// @namespace    https://github.com/defffis/FakeGPS_Tampermonkey
// @version      2.0.0
// @license      AGPLv3
// @author       defffis
// @description  Per-site geolocation override: real GPS, stable random coordinates, or manually specified coordinates.
// @homepageURL  https://github.com/defffis/FakeGPS_Tampermonkey
// @supportURL   https://github.com/defffis/FakeGPS_Tampermonkey/issues
// @downloadURL  https://raw.githubusercontent.com/defffis/FakeGPS_Tampermonkey/main/Menu%20Fake%20GPS.js
// @updateURL    https://raw.githubusercontent.com/defffis/FakeGPS_Tampermonkey/main/Menu%20Fake%20GPS.js
// @match        *://*/*
// @exclude      *://www.report-real-gps.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        unsafeWindow
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  const STORAGE_KEY = 'fakeGpsSettingsV2';
  const MIGRATION_KEY = 'fakeGpsMigratedToV2';

  // Keep the old random area for backwards-compatible behaviour,
  // but use realistic browser geolocation metadata.
  const RANDOM_BOUNDS = Object.freeze({
    minLatitude: 45.000001,
    maxLatitude: 53.999999,
    minLongitude: 2.000000,
    maxLongitude: 30.630999
  });

  const pageWindow = typeof unsafeWindow !== 'undefined' ? unsafeWindow : window;
  const pageNavigator = pageWindow.navigator;
  const currentDomain = pageWindow.location.hostname;

  function readSettings() {
    const value = GM_getValue(STORAGE_KEY, {});
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  }

  function writeSettings(settings) {
    GM_setValue(STORAGE_KEY, settings);
  }

  function splitLegacyDomains(value) {
    if (typeof value !== 'string' || value.trim() === '') {
      return [];
    }

    return value
      .split(',')
      .map(domain => domain.trim())
      .filter(Boolean);
  }

  function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
  }

  function isValidLocation(location) {
    if (!location) {
      return false;
    }

    const latitude = toNullableNumber(location.latitude);
    const longitude = toNullableNumber(location.longitude);

    return Boolean(
      latitude !== null &&
      longitude !== null &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }

  function toNullableNumber(value) {
    if (value === null || value === undefined || value === '') {
      return null;
    }

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function normalizeLocation(location) {
    const accuracy = Number(location.accuracy);
    const altitude = toNullableNumber(location.altitude);
    const altitudeAccuracy = toNullableNumber(location.altitudeAccuracy);
    const heading = toNullableNumber(location.heading);
    const speed = toNullableNumber(location.speed);

    return {
      latitude: Number(location.latitude),
      longitude: Number(location.longitude),
      accuracy: Number.isFinite(accuracy) && accuracy > 0 ? Math.max(1, accuracy) : 20,
      altitude,
      altitudeAccuracy:
        altitude !== null && altitudeAccuracy !== null
          ? Math.max(0, altitudeAccuracy)
          : null,
      heading:
        heading !== null
          ? ((heading % 360) + 360) % 360
          : null,
      speed:
        speed !== null && speed >= 0
          ? speed
          : null
    };
  }

  function migrateLegacyStorage() {
    if (GM_getValue(MIGRATION_KEY, false)) {
      return;
    }

    const settings = readSettings();
    const legacyMatches = splitLegacyDomains(GM_getValue('myScriptMatch', ''));
    const legacyExclusions = splitLegacyDomains(GM_getValue('myScriptExclusions', ''));
    const legacyDomains = new Set([...legacyMatches, ...legacyExclusions]);

    // Preserve sites where the user explicitly requested real geolocation.
    for (const domain of legacyExclusions) {
      settings[domain] = { mode: 'real' };
    }

    // v1.x only offered hard-coded fake-location presets.
    // Do not migrate them: all saved fake points from the old version are discarded.

    // Remove all v1.x per-domain values and obsolete lists.
    for (const domain of legacyDomains) {
      GM_deleteValue(domain);
    }

    GM_deleteValue('myScriptMatch');
    GM_deleteValue('myScriptExclusions');

    writeSettings(settings);
    GM_setValue(MIGRATION_KEY, true);
  }

  function randomBetween(min, max) {
    return Math.random() * (max - min) + min;
  }

  function generateRandomLocation() {
    return {
      latitude: randomBetween(RANDOM_BOUNDS.minLatitude, RANDOM_BOUNDS.maxLatitude),
      longitude: randomBetween(RANDOM_BOUNDS.minLongitude, RANDOM_BOUNDS.maxLongitude),
      accuracy: randomBetween(8, 35),
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null
    };
  }

  function getSiteConfig() {
    const settings = readSettings();
    let config = settings[currentDomain];

    if (!config || !['real', 'random', 'fixed'].includes(config.mode)) {
      config = {
        mode: 'random',
        location: generateRandomLocation()
      };
      settings[currentDomain] = config;
      writeSettings(settings);
      return config;
    }

    if (config.mode === 'random' && !isValidLocation(config.location)) {
      config.location = generateRandomLocation();
      settings[currentDomain] = config;
      writeSettings(settings);
    }

    if (config.mode === 'fixed' && !isValidLocation(config.location)) {
      config = {
        mode: 'random',
        location: generateRandomLocation()
      };
      settings[currentDomain] = config;
      writeSettings(settings);
    }

    return config;
  }

  function setSiteConfig(config) {
    const settings = readSettings();
    settings[currentDomain] = config;
    writeSettings(settings);
  }

  function reloadPage() {
    pageWindow.location.reload();
  }

  function useRealLocation() {
    setSiteConfig({ mode: 'real' });
    reloadPage();
  }

  function useRandomLocation() {
    setSiteConfig({
      mode: 'random',
      location: generateRandomLocation()
    });
    reloadPage();
  }

  function parseInputNumber(value) {
    if (typeof value !== 'string') {
      return NaN;
    }

    return Number(value.trim().replace(',', '.'));
  }

  function setManualLocation() {
    const currentConfig = getSiteConfig();
    const currentLocation = currentConfig.location || {};

    const latitudeText = pageWindow.prompt(
      'Широта (-90 … 90):',
      isFiniteNumber(currentLocation.latitude) ? String(currentLocation.latitude) : ''
    );

    if (latitudeText === null) {
      return;
    }

    const longitudeText = pageWindow.prompt(
      'Долгота (-180 … 180):',
      isFiniteNumber(currentLocation.longitude) ? String(currentLocation.longitude) : ''
    );

    if (longitudeText === null) {
      return;
    }

    const accuracyText = pageWindow.prompt(
      'Точность в метрах (> 0):',
      isFiniteNumber(currentLocation.accuracy) ? String(currentLocation.accuracy) : '20'
    );

    if (accuracyText === null) {
      return;
    }

    const latitude = parseInputNumber(latitudeText);
    const longitude = parseInputNumber(longitudeText);
    const accuracy = parseInputNumber(accuracyText);

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180 ||
      !Number.isFinite(accuracy) ||
      accuracy <= 0
    ) {
      pageWindow.alert('Некорректные координаты или точность.');
      return;
    }

    setSiteConfig({
      mode: 'fixed',
      location: {
        latitude,
        longitude,
        accuracy,
        altitude: null,
        altitudeAccuracy: null,
        heading: null,
        speed: null
      }
    });

    reloadPage();
  }

  function createPosition(location) {
    const normalized = normalizeLocation(location);

    const coords = Object.freeze({
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      accuracy: normalized.accuracy,
      altitude: normalized.altitude,
      altitudeAccuracy: normalized.altitudeAccuracy,
      heading: normalized.heading,
      speed: normalized.speed
    });

    return Object.freeze({
      coords,
      timestamp: Date.now()
    });
  }

  function createMockGeolocation(location) {
    const watches = new Map();
    let nextWatchId = 1;

    function getCurrentPosition(success, error, options) {
      if (typeof success !== 'function') {
        throw new TypeError(
          "Failed to execute 'getCurrentPosition' on 'Geolocation': parameter 1 is not of type 'Function'."
        );
      }

      pageWindow.setTimeout(() => {
        success(createPosition(location));
      }, 0);
    }

    function watchPosition(success, error, options) {
      if (typeof success !== 'function') {
        throw new TypeError(
          "Failed to execute 'watchPosition' on 'Geolocation': parameter 1 is not of type 'Function'."
        );
      }

      const watchId = nextWatchId++;

      const emit = () => {
        try {
          success(createPosition(location));
        } catch (callbackError) {
          pageWindow.console.error('[Menu Fake GPS] watchPosition callback error:', callbackError);
        }
      };

      emit();

      const intervalId = pageWindow.setInterval(emit, 1000);
      watches.set(watchId, intervalId);

      return watchId;
    }

    function clearWatch(watchId) {
      const intervalId = watches.get(watchId);

      if (intervalId !== undefined) {
        pageWindow.clearInterval(intervalId);
        watches.delete(watchId);
      }
    }

    return Object.freeze({
      getCurrentPosition,
      watchPosition,
      clearWatch
    });
  }

  function installMockGeolocation(location) {
    const mockGeolocation = createMockGeolocation(location);

    try {
      Object.defineProperty(pageNavigator, 'geolocation', {
        configurable: true,
        enumerable: true,
        value: mockGeolocation
      });
      return;
    } catch (error) {
      // Some browsers expose geolocation only through Navigator.prototype.
    }

    const navigatorPrototype = Object.getPrototypeOf(pageNavigator);

    try {
      Object.defineProperty(navigatorPrototype, 'geolocation', {
        configurable: true,
        enumerable: true,
        get: () => mockGeolocation
      });
    } catch (error) {
      pageWindow.console.error('[Menu Fake GPS] Failed to override navigator.geolocation:', error);
    }
  }

  function registerMenu(config) {
    const realPrefix = config.mode === 'real' ? '✓ ' : '';
    const randomPrefix = config.mode === 'random' ? '✓ ' : '';
    const fixedPrefix = config.mode === 'fixed' ? '✓ ' : '';

    GM_registerMenuCommand(realPrefix + 'Использовать реальное местоположение', useRealLocation);
    GM_registerMenuCommand(randomPrefix + 'Использовать случайные координаты', useRandomLocation);
    GM_registerMenuCommand(fixedPrefix + 'Задать координаты вручную…', setManualLocation);
  }

  migrateLegacyStorage();

  const config = getSiteConfig();
  registerMenu(config);

  if (config.mode !== 'real') {
    installMockGeolocation(config.location);
  }
})();
