// ==UserScript==
// @name         Japan Areas
// @namespace    http://tampermonkey.net/
// @version      2025-11-24
// @description  try to take over the world!
// @author       You
// @match        https://www.google.com/maps/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=google.com
// @grant        none
// ==/UserScript==

(async () => {
  // ======= 可調整 =======
  const API_KEY = 'AIzaSyD80RVCd4Em7_hQ8NPrt7W2HlsKouvxpUA';
  const defaultCenter = { lat: 35.658581, lng: 139.745438 }; // 東京塔

  // get places
  const places = await fetch('https://raw.githubusercontent.com/fluvo/place-group-kits/refs/heads/main/places.json')
    .then(response => response.json());

  // get groups
  const groups = await fetch('https://raw.githubusercontent.com/fluvo/place-group-kits/refs/heads/main/groups.json')
    .then(response => response.json());

  // ======================

  if (typeof google === 'undefined' || !google.maps) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}`;
      s.async = true;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Maps JS 載入失敗'));
      document.head.appendChild(s);
    });
  }

  let el = document.getElementById('consoleMap');
  if (!el) {
    el = document.createElement('div');
    el.id = 'consoleMap';
    Object.assign(el.style, { position:'fixed', inset:0, width:'100vw', height:'100vh', zIndex:9999 });
    document.body.appendChild(el);
  }

  const map = new google.maps.Map(el, {
    center: defaultCenter, zoom: 12, mapTypeId: 'roadmap',
    clickableIcons: false, streetViewControl: false, mapTypeControl: false
  });

  // ★ 自訂橘色點的文字標籤（白底＋陰影）
  class OrangeLabel extends google.maps.OverlayView {
  
    constructor(position, text, map) {
      super();
      this.position = position;
      this.text = text;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      // 貼在 marker 上方一點點
      div.style.transform = 'translate(-50%, -100%) translateY(-16px)';
      div.style.background = '#ffffff';
      div.style.borderRadius = '4px';
      div.style.padding = '2px 6px';
      div.style.fontSize = '11px';
      div.style.fontWeight = '600';
      div.style.color = '#A94700';
      div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.35)';
      div.style.whiteSpace = 'nowrap';
      div.style.pointerEvents = 'none'; // 不影響地圖操作
      div.textContent = this.text;

      this.div = div;
      const panes = this.getPanes();
      panes.overlayImage.appendChild(div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;

      const pos = projection.fromLatLngToDivPixel(this.position);
      if (!pos) return;

      this.div.style.left = pos.x + 'px';
      this.div.style.top = pos.y + 'px';
    }

    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
      }
      this.div = null;
    }

    setPosition(position) {
      this.position = position;
      this.draw();
    }

    setText(text) {
      this.text = text;
      if (this.div) this.div.textContent = text;
    }
  }

  // hide the close button of info windows
  const style = document.createElement('style');
  style.textContent = `
    #consoleMap .gm-ui-hover-effect {
      display: none !important;
    }
    #consoleMap .gm-style-iw-ch {
      padding-top: 8px !important;
    }
  `;
  document.head.appendChild(style);

  const svgYellowPin = {
    path: "M12 2C7.58 2 4 5.58 4 10c0 5.25 8 12 8 12s8-6.75 8-12c0-4.42-3.58-8-8-8zm0 11.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z",
    fillColor: "#F7C948",
    fillOpacity: 1,
    strokeColor: "#A27F1A",
    strokeWeight: 1,
    scale: 1.3,
    anchor: new google.maps.Point(12,24),
  };
  const svgOrangeDot = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: "#FF7A00",
    fillOpacity: 0.95,
    strokeColor: "#A94700",
    strokeWeight: 1.5,
    scale: 7,
    // 讓 label 顯示在圓點上方一點
    labelOrigin: new google.maps.Point(0, -12)
  };
  
  const bounds = new google.maps.LatLngBounds();
  const yellowInfoWindows = [];
  const orangeItems = [];

  function generateId() {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let id = '';
    for (let i = 0; i < 6; i++) {
      id += letters[Math.floor(Math.random() * letters.length)];
    }
    return id;
  }

  // 黃色：固定座標 + 各自 InfoWindow（點擊 toggle 開關；右鍵選單：1 編輯 / 2 刪除）
  function createPlaceMarker(p) {
    const pos = { lat: p.lat, lng: p.lng };

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: svgYellowPin,
      title: `${p.id} - ${p.locales.ja.name} (${p.locales.en.name})`
    });

    const iw = new google.maps.InfoWindow({
      content:
        `<div style="font-size:11px;color:#777;margin-bottom:2px;">${p.id || ''}</div>` +
        `<b style="font-size:14px;color:#7a5">${p.locales.ja.name}</b>` +
        `<div>${p.locales.en.name}</div>`
    });

    // 初始打開
    iw.open({ map, anchor: marker });

    let isOpen = true;

    // 左鍵：toggle 開 / 關
    marker.addListener('click', () => {
      if (isOpen) {
        iw.close();
      } else {
        iw.open({ map, anchor: marker });
      }
      isOpen = !isOpen;
    });

    // ⭐ 右鍵：1 編輯 / 2 刪除（刪除前再確認一次）
    marker.addListener('rightclick', () => {
      const choice = prompt('右鍵選擇動作：\n1 = 編輯名稱\n2 = 刪除地標', '1');
      if (choice === null) return;

      if (choice === '1') {
        const newJp = prompt('重設地點：輸入主要名稱', p.locales?.ja?.name || '');
        if (newJp === null) return;
        const newEn = prompt('重設地點：輸入英文名稱', p.locales?.en?.name || '');
        if (newEn === null) return;

        p.locales = p.locales || {};
        p.locales.ja = p.locales.ja || {};
        p.locales.en = p.locales.en || {};
        p.locales.ja.name = newJp;
        p.locales.en.name = newEn;

        marker.setTitle(`${p.id} - ${p.locales.ja.name} (${p.locales.en.name})`);
        iw.setContent(
          `<div style="font-size:11px;color:#777;margin-bottom:2px;">ID: ${p.id || ''}</div>` +
          `<b style="font-size:14px;color:#7a5">${p.locales.ja.name}</b>` +
          `<div>${p.locales.en.name}</div>`
        );
        if (!isOpen) {
          iw.open({ map, anchor: marker });
          isOpen = true;
        }
      } else if (choice === '2') {
        const ok = confirm('要刪除這個地標嗎？');
        if (!ok) return;

        iw.close();
        marker.setMap(null);

        const iwIndex = yellowInfoWindows.indexOf(iw);
        if (iwIndex >= 0) yellowInfoWindows.splice(iwIndex, 1);

        const placeIndex = places.indexOf(p);
        if (placeIndex >= 0) places.splice(placeIndex, 1);

        console.log('Place removed:', p);
      }
    });

    yellowInfoWindows.push(iw);
    bounds.extend(pos);
  }

  // ★ 初始化：把 GitHub 來的 places 都畫出來
  for (const p of places) {
    createPlaceMarker(p);
  }

  // 共用：建立 place（latLng 可為 LatLng 或 {lat,lng}）
  function createNewPlaceAt(latLng) {
    if (!latLng) return;

    const toNum = (v) => +Number(v).toFixed(6);

    const lat = typeof latLng.lat === 'function'
      ? toNum(latLng.lat())
      : toNum(latLng.lat);
    const lng = typeof latLng.lng === 'function'
      ? toNum(latLng.lng())
      : toNum(latLng.lng);

    const ja = prompt('新增地點：輸入主要名稱', '');
    if (ja === null) return;

    const en = prompt('新增地點：輸入英文名稱', '');
    if (en === null) return;

    const newPlace = {
      id: generateId(),
      lat,
      lng,
      locales: {
        ja: {
          name: ja
        },
        en: {
          name: en
        }
      }
    };
    places.push(newPlace);
    createPlaceMarker(newPlace);

    console.log('New place added:', newPlace);
  }

  // 共用：實際在地圖上建立一個橘色 group（marker + circle + label + panel），並與 groups 同步
  function buildOrangeGroupOnMap(groupData) {
    const pos = { lat: groupData.lat, lng: groupData.lng };

    const placeNameById = (id) => {
      const place = places.find(pl => pl.id === id);
      return place?.locales?.ja?.name || '';
    };

    const computeGroupLabel = (g) => {
      if (Array.isArray(g.placeIds) && g.placeIds.length > 0) {
        const names = g.placeIds
          .map(placeNameById)
          .filter(Boolean);
        if (names.length) return names.join('、');
      }
      return g.name || '';
    };

    const labelText = computeGroupLabel(groupData);

    // 若尚未被加入 groups（例如初始化以外的情境），確保 groups 也有這筆資料
    const exists = groups.some(g =>
      Math.abs(g.lat - groupData.lat) < 1e-6 &&
      Math.abs(g.lng - groupData.lng) < 1e-6 &&
      g.radius === groupData.radius
    );
    if (!exists) {
      groups.push({
        id: groupData.id,
        placeIds: groupData.placeIds,
        lat: groupData.lat,
        lng: groupData.lng,
        radius: groupData.radius
      });
    }

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: svgOrangeDot,
      draggable: true,
      title: labelText
    });

    const labelOverlay = new OrangeLabel(new google.maps.LatLng(pos.lat, pos.lng), labelText, map);

    const circle = new google.maps.Circle({
      map,
      center: pos,
      radius: groupData.radius,
      strokeColor:'#FF7A00',
      strokeOpacity:0.9,
      strokeWeight:2,
      fillColor:'#FF7A00',
      fillOpacity:0.15
    });

    circle.bindTo('center', marker, 'position');

    const o = { id: groupData.id, placeIds: groupData.placeIds || [], marker, circle, labelOverlay };
    orangeItems.push(o);

    // 拖曳時讓 label 跟著位置移動，並同步更新 groups 中的座標
    marker.addListener('position_changed', () => {
      const currentPos = marker.getPosition();
      if (currentPos) {
        labelOverlay.setPosition(currentPos);

        const gx = groups.find(g => g.id === o.id);
        if (gx) {
          gx.lat = +currentPos.lat().toFixed(6);
          gx.lng = +currentPos.lng().toFixed(6);
        }
      }
    });

    // 右鍵一律共用 1/2 選單
    circle.addListener('rightclick', (e) => {
      handleMapRightClick({ latLng: e.latLng || circle.getCenter() });
    });
    marker.addListener('rightclick', (e) => {
      handleMapRightClick({ latLng: e.latLng || marker.getPosition() });
    });

    appendOrangeControlBlock(o);

    marker.addListener('dragend', printOrangeState);

    return { o, marker };
  }

  // 共用：建立 group（橘色範圍）且同步控制面板與 groups
  function createNewGroupAt(latLng, defaultName = 'New Area', defaultRadius = 1000) {
    if (!latLng) return;

    const lat = +latLng.lat().toFixed(6);
    const lng = +latLng.lng().toFixed(6);

    const groupData = { id: generateId(), placeIds: [], lat, lng, radius: defaultRadius };

    const { marker } = buildOrangeGroupOnMap(groupData);
    bounds.extend(marker.getPosition());

    printOrangeState();
    console.log('New group added:', groupData);
  }

  // 右鍵時詢問要新增地點或範圍
  function handleMapRightClick(e) {
    if (!e.latLng) return;

    const choice = prompt('右鍵選擇動作：\n1 = 新增地點\n2 = 新增範圍 (預設半徑 1000m)', '1');
    if (choice === null) return;

    if (choice === '1') {
      createNewPlaceAt(e.latLng);
    } else if (choice === '2') {
      createNewGroupAt(e.latLng);
    }
  }

  // 地圖空白處右鍵 → 選單（新增地點 / 新增範圍）
  map.addListener('rightclick', handleMapRightClick);

  // 特別版 JSON.stringify：key 順序為 id, locales，其餘按字母排序
  function stringifyWithCustomKeyOrder(value, space = 2) {
    function reorderKeys(obj) {
      if (obj === null || typeof obj !== 'object') return obj;

      if (Array.isArray(obj)) {
        return obj.map(reorderKeys);
      }

      const keys = Object.keys(obj);
      const special = ['id', 'locales', 'placeIds'].filter(k => keys.includes(k));
      const others = keys.filter(k => !special.includes(k)).sort();

      const ordered = {};
      for (const k of [...special, ...others]) {
        ordered[k] = reorderKeys(obj[k]);
      }
      return ordered;
    }

    const normalized = reorderKeys(value);
    return JSON.stringify(normalized, null, space);
  }

  // === 橘色控制面板 ===
  const control = document.createElement('div');
  control.style.cssText =
    'position:fixed;bottom:10px;right:10px;background:#fff;padding:10px;border:1px solid #ccc;border-radius:8px;max-height:60vh;font-family:system-ui;font-size:12px;z-index:99999;display:flex;flex-direction:column;';

  const controlHeader = document.createElement('div');
  controlHeader.innerHTML = `<b style="font-size:13px;">Orange Radius Control</b>`;
  controlHeader.style.flex = '0 0 auto';
  controlHeader.style.marginBottom = '4px';

  // 下載 JSON 小工具
  function downloadJson(filename, obj) {
    const blob = new Blob([stringifyWithCustomKeyOrder(obj, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // 儲存按鈕列
  const toolbar = document.createElement('div');
  toolbar.style.margin = '6px 0 4px';
  toolbar.style.display = 'flex';
  toolbar.style.gap = '4px';
  toolbar.style.flexWrap = 'wrap';

  const savePlacesBtn = document.createElement('button');
  savePlacesBtn.type = 'button';
  savePlacesBtn.textContent = '💾 下載 places.json';
  savePlacesBtn.style.fontSize = '11px';
  savePlacesBtn.style.padding = '2px 6px';
  savePlacesBtn.style.cursor = 'pointer';
  savePlacesBtn.onclick = () => {
    downloadJson('places.json', places);
  };

  const saveGroupsBtn = document.createElement('button');
  saveGroupsBtn.type = 'button';
  saveGroupsBtn.textContent = '💾 下載 groups.json';
  saveGroupsBtn.style.fontSize = '11px';
  saveGroupsBtn.style.padding = '2px 6px';
  saveGroupsBtn.style.cursor = 'pointer';
  saveGroupsBtn.onclick = () => {
    downloadJson('groups.json', groups);
  };

  toolbar.append(savePlacesBtn, saveGroupsBtn);

  // 中間區塊：所有 group 控制列都塞這裡（可滾動）
  const groupsContainer = document.createElement('div');
  groupsContainer.style.flex = '1 1 auto';
  groupsContainer.style.overflowY = 'auto';

  // 底部 footer：分隔線 + 下載按鈕（固定區塊）
  const footer = document.createElement('div');
  footer.style.flex = '0 0 auto';
  footer.append(document.createElement('hr'));
  footer.append(toolbar);

  function appendOrangeControlBlock(o) {
    const block = document.createElement('div');
    block.style.margin = '8px 0';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';

    // 左側：顯示這個 group 目前包含的 place（chips，可刪除）
    const namesContainer = document.createElement('div');
    namesContainer.style.display = 'flex';
    namesContainer.style.flexWrap = 'wrap';
    namesContainer.style.gap = '2px';
    namesContainer.style.flex = '1';

    // 新增成員按鈕（觸發輸入 place id 的 prompt）
    const addMemberBtn = document.createElement('button');
    addMemberBtn.type = 'button';
    addMemberBtn.textContent = '➕';
    addMemberBtn.style.fontSize = '11px';
    addMemberBtn.style.padding = '0 4px';
    addMemberBtn.style.marginLeft = '16px';
    addMemberBtn.style.cursor = 'pointer';
    addMemberBtn.style.border = '1px solid #b0d4ff';
    addMemberBtn.style.borderRadius = '4px';
    addMemberBtn.style.background = '#e8f3ff';
    addMemberBtn.style.color = '#0050b3';

    // 刪除按鈕
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.textContent = '❌';
    deleteBtn.style.fontSize = '11px';
    deleteBtn.style.padding = '0 4px';
    deleteBtn.style.marginLeft = '4px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.border = '1px solid #f2b0b0';
    deleteBtn.style.borderRadius = '4px';
    deleteBtn.style.background = '#ffecec';
    deleteBtn.style.color = '#b00000';

    deleteBtn.onclick = () => {
      const ok = confirm(`要刪除這個範圍嗎？`);
      if (!ok) return;

      // 從地圖移除
      if (o.circle) o.circle.setMap(null);
      if (o.marker) o.marker.setMap(null);
      if (o.labelOverlay && typeof o.labelOverlay.onRemove === 'function') {
        o.labelOverlay.onRemove();
      }

      // 從狀態陣列移除
      const idx = orangeItems.indexOf(o);
      if (idx >= 0) orangeItems.splice(idx, 1);

      const gIdx = groups.findIndex(g => g.id === o.id);
      if (gIdx >= 0) groups.splice(gIdx, 1);

      // 從面板移除 UI 區塊
      block.remove();

      printOrangeState();
    };

    function rebuildPlaceChips() {
      namesContainer.innerHTML = '';

      if (!Array.isArray(o.placeIds) || o.placeIds.length === 0) {
        const empty = document.createElement('span');
        empty.textContent = '(no places)';
        empty.style.fontSize = '11px';
        empty.style.color = '#999';
        namesContainer.appendChild(empty);
        return;
      }

      for (const placeId of o.placeIds) {
        const place = places.find(p => p.id === placeId);
        const label = place?.locales?.ja?.name || placeId || '';

        const chip = document.createElement('span');
        chip.style.display = 'inline-flex';
        chip.style.alignItems = 'center';
        chip.style.borderRadius = '999px';
        chip.style.border = '1px solid #ddd';
        chip.style.padding = '0 4px';
        chip.style.fontSize = '11px';
        chip.style.background = '#fafafa';

        const textSpan = document.createElement('span');
        textSpan.textContent = label;

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = '×';
        removeBtn.style.marginLeft = '2px';
        removeBtn.style.border = 'none';
        removeBtn.style.background = 'transparent';
        removeBtn.style.cursor = 'pointer';
        removeBtn.style.fontSize = '11px';
        removeBtn.style.color = '#b00000';

        removeBtn.onclick = () => {
          o.placeIds = o.placeIds.filter(id => id !== placeId);
          const g = groups.find(g => g.id === o.id);
          if (g) {
            g.placeIds = o.placeIds.slice();
          }

          const names = o.placeIds
            .map(id => {
              const pl = places.find(p => p.id === id);
              return pl?.locales?.ja?.name || '';
            })
            .filter(Boolean);
          const newLabel = names.join('、');
          if (o.marker) o.marker.setTitle(newLabel);
          if (o.labelOverlay && typeof o.labelOverlay.setText === 'function') {
            o.labelOverlay.setText(newLabel);
          }

          rebuildPlaceChips();
          printOrangeState();
        };

        chip.append(textSpan, removeBtn);
        namesContainer.appendChild(chip);
      }
    }

    function updateGroupLabelFromPlaces() {
      const names = (o.placeIds || [])
        .map(id => {
          const pl = places.find(p => p.id === id);
          return pl?.locales?.ja?.name || '';
        })
        .filter(Boolean);
      const newLabel = names.join('、');
      if (o.marker) o.marker.setTitle(newLabel);
      if (o.labelOverlay && typeof o.labelOverlay.setText === 'function') {
        o.labelOverlay.setText(newLabel);
      }
    }

    function doAddById(raw) {
      if (!raw) return;
      const placeId = raw.trim().toUpperCase();
      if (!placeId) return;

      const place = places.find(p => p.id === placeId);
      if (!place) {
        alert(`找不到 id 為 ${placeId} 的地點`);
        return;
      }
      if (o.placeIds.includes(placeId)) {
        alert(`這個範圍已經包含 ${placeId}`);
        return;
      }

      o.placeIds.push(placeId);
      const g = groups.find(g => g.id === o.id);
      if (g) {
        g.placeIds = Array.from(new Set([...(g.placeIds || []), placeId]));
      }

      updateGroupLabelFromPlaces();
      rebuildPlaceChips();
      printOrangeState();
    }

    // 點 ➕：用 prompt 輸入 place id 並加入 group
    addMemberBtn.onclick = () => {
      const raw = prompt('輸入要加入這個範圍的 place id');
      if (raw === null) return;
      doAddById(raw);
    };

    headerRow.append(namesContainer, addMemberBtn, deleteBtn);

    // 下面一行：slider + 距離
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.marginTop = '2px';

    const input = document.createElement('input');
    input.type = 'range';
    input.min = 100;
    input.max = 6000;
    input.step = 100;
    input.value = o.circle.getRadius();
    input.style.width = '200px';

    const valueEl = document.createElement('span');
    valueEl.textContent = `${Math.round(o.circle.getRadius())}m`;
    valueEl.style.marginLeft = '8px';
    valueEl.style.minWidth = '48px'; // 避免寬度跳動

    input.oninput = () => {
      const val = Math.round(Number(input.value));
      o.circle.setRadius(val);
      valueEl.textContent = `${val}m`;

      // 同步更新 groups 裡對應範圍的 radius
      const pos = o.marker && o.marker.getPosition();
      if (pos) {
        const g = groups.find(g => g.id === o.id);
        if (g) g.radius = val;
      }

      printOrangeState();
    };

    row.append(input, valueEl);

    block.append(headerRow, row);
    rebuildPlaceChips();
    groupsContainer.append(block);
  }

  // 橘色：圓 + 滑桿控制（初始化既有 groups）
  for (const p of groups) {
    const { marker } = buildOrangeGroupOnMap(p);
    bounds.extend(marker.getPosition());
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds);

  // 控制面板組完所有區塊後，先掛 header、group 區塊，再掛 footer（內含下載按鈕）
  control.append(controlHeader);
  control.append(groupsContainer);
  control.append(footer);

  document.body.append(control);

  // === Console 輸出 ===
  function printOrangeState() {
    const arr = orangeItems.map(o => {
      const pos = o.marker.getPosition();
      const g = groups.find(g => g.id === o.id) || {};
      return { id:g.id, placeIds:g.placeIds, lat:+pos.lat().toFixed(6), lng:+pos.lng().toFixed(6), radius:Math.round(o.circle.getRadius()) };
    });
    console.clear();
    console.log(stringifyWithCustomKeyOrder(arr, 2));
  }

  // 拖曳更新後重新印出
  orangeItems.forEach(o => o.marker.addListener('dragend', printOrangeState));

  printOrangeState();
})();
