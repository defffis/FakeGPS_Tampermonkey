// ==UserScript==
// @name         Menu Fake GPS
// @namespace    https://github.com/defffis/FakeGPS_Tampermonkey
// @version      1.0.4
// @license      AGPLv3
// @author       defffis
// @description  Falsify GPS location to protect privacy, or to provide a virtual location sensor device. This script should either be be configured for specific sites only, or for all sites but excludes some specific sites.
// @downloadURL  https://raw.githubusercontent.com/defffis/FakeGPS_Tampermonkey/mobile-main/Menu%20Fake%20GPS.js
// @match        *://*/*
// @match        *://*
// @exclude      *://www.report-real-gps.com/*
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @run-at       document-start
// ==/UserScript==

(function() {
  'use strict';

  // Функция для получения домена из URL
  function getDomainFromUrl(url) {
    let hostname;
    // Находим и удаляем протокол (http, https) из URL
    if (url.indexOf("://") > -1) {
      hostname = url.split('/')[2];
    } else {
      hostname = url.split('/')[0];
    }
    // Удаляем порт из домена (если есть)
    hostname = hostname.split(':')[0];
    return hostname;
  }

  // Проверяем, нужно ли выполнять скрипт на текущем сайте
  function checkMatch() {
  let currentPageUrl = window.location.href;
  let currentPageDomain = getDomainFromUrl(currentPageUrl);
  let existingMatch = GM_getValue('myScriptMatch', '');

  if (existingMatch.includes(currentPageDomain)) {
    // Выполняем скрипт только на сайтах, добавленных в match

    // Получаем сохраненные координаты для текущего сайта
    let savedLocation = GM_getValue(currentPageDomain, null);

    // Если для текущего сайта есть сохраненные координаты, используем их
    if (savedLocation !== null) {
      setMockLocation(savedLocation);
    } else {
      // Иначе используем значения по умолчанию
      setMockLocation({
        latitude: defaultLatitude,
        longitude: defaultLongitude,
        accuracy: defaultAccuracy,
        altitude: defaultAltitude,
        altitudeAccuracy: defaultAltitudeAccuracy,
        heading: defaultHeading,
        speed: defaultSpeed
      });
    }

    // Вместо этого места можно разместить ваш код для выполнения на этих сайтах
    console.log('Скрипт выполняется на сайте: ' + currentPageDomain);
  }
}

  // Функция для установки фиктивного местоположения
function setMockLocation(location) {
  // Create a mock geolocation object
  const mockGeolocation = {
    getCurrentPosition: function(succ, err) {
      setTimeout(() => {
        let coords = {
          latitude: location.latitude,
          longitude: location.longitude,
          accuracy: location.accuracy,
          altitude: location.altitude,
          altitudeAccuracy: location.altitudeAccuracy,
          heading: location.heading,
          speed: location.speed
        };
        let timestamp = (new Date()).getTime();
        succ({ coords, timestamp });
      }, 0);
    },
    watchPosition: function(succ, err) {
      return setInterval(() => {
        this.getCurrentPosition(succ, err);
      }, 1000); // Set the watchInterval to 1000ms (1 second)
    },
    clearWatch: function(id) {
      clearInterval(id);
    }
  };

  // Override the original navigator.geolocation with the mock object
  Object.defineProperty(navigator, 'geolocation', {
    value: mockGeolocation
  });
}

  // Функция для добавления текущей страницы в match скрипта
  function addCurrentPageToMatch() {
    let currentPageUrl = window.location.href;
    let currentPageDomain = getDomainFromUrl(currentPageUrl);
    let existingMatch = GM_getValue('myScriptMatch', '');

    if (!existingMatch.includes(currentPageDomain)) {
      let newMatch = existingMatch ? existingMatch + ',' + currentPageDomain : currentPageDomain;
      GM_setValue('myScriptMatch', newMatch);
      alert('Домен текущей страницы добавлен в хранилище скрипта.');
    } else {
      alert('Домен текущей страницы уже присутствует в хранилище скрипта.');
    }
  }


    // Функция для удаления текущего сайта из хранилища
function removeCurrentSiteFromStorage() {
  let currentPageUrl = window.location.href;
  let currentPageDomain = getDomainFromUrl(currentPageUrl);
  GM_deleteValue(currentPageDomain);
  alert('Местоположение для текущего сайта удалено из хранилища.');
}

  // Функция для сохранения выбранного местоположения для текущего сайта
  function saveLocationForCurrentSite(location) {
    let currentPageUrl = window.location.href;
    let currentPageDomain = getDomainFromUrl(currentPageUrl);
    GM_setValue(currentPageDomain, location);
    alert('Местоположение сохранено для текущего сайта.');
  }

  // Список готовых пресетов геопозиций
  var presets = {
    "Минск Песочница": {
      latitude: 53.915525,
      longitude: 27.568870,
      accuracy: 0.009469,
      altitude: 214,
      altitudeAccuracy: 1,
      heading: 135,
      speed: 0
    },
    "Минск Троицкого/Сторожовская": {
      latitude: 53.912972,
      longitude: 27.555453,
      accuracy: 0.009469,
      altitude: 214,
      altitudeAccuracy: 1,
      heading: 135,
      speed: 0
    },
    "Минск Галерея": {
      latitude: 53.908512,
      longitude: 27.548552,
      accuracy: 0.009469,
      altitude: 214,
      altitudeAccuracy: 1,
      heading: 135,
      speed: 0
    },
    "Минск Мир": {
      latitude: 53.869199,
      longitude: 27.535535,
      accuracy: 0.009469,
      altitude: 214,
      altitudeAccuracy: 1,
      heading: 135,
      speed: 0
    },
    "Минск Мир 2": {
      latitude: 53.867464,
      longitude: 27.541219,
      accuracy: 0.009469,
      altitude: 214,
      altitudeAccuracy: 1,
      heading: 135,
      speed: 0
    },
    "ЖК парк Челюскинцев": {
      latitude: 53.923994,
      longitude: 27.624810,
      accuracy: 0.009469,
      altitude: 214,
      altitudeAccuracy: 1,
      heading: 135,
      speed: 0
    }
    // Добавьте другие пресеты по аналогии, если нужно
  };

  // Добавляем кнопку в меню Tampermonkey для добавления текущей страницы в match скрипта
  GM_registerMenuCommand('Добавить текущую страницу в правила', addCurrentPageToMatch);


    // Добавляем кнопку в меню Tampermonkey для удаления текущего сайта из хранилища
GM_registerMenuCommand('Удалить местоположение', removeCurrentSiteFromStorage);

  // Добавляем список пресетов геопозиций в меню Tampermonkey
  Object.keys(presets).forEach(presetName => {
    GM_registerMenuCommand(presetName, function() {
      saveLocationForCurrentSite(presets[presetName]);
    });
  });

  // Проверяем, нужно ли выполнять скрипт на текущем сайте
  checkMatch();

})();
