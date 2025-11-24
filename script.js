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

  // 黃色：固定座標 + 各自 InfoWindow（點擊 toggle 開關）
  function createPlaceMarker(p) {
    const pos = { lat: p.lat, lng: p.lng };

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: svgYellowPin,
      title: `${p.name} (${p.name_en})`
    });

    const iw = new google.maps.InfoWindow({
      content: `<b style="font-size:14px;color:#7a5">${p.name}</b><div>${p.name_en}</div>`
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

    // ⭐ 右鍵：詢問是否刪除這個黃色點
    marker.addListener('rightclick', () => {
      const ok = confirm('要刪除這個地標嗎？');
      if (!ok) return;

      // 1. 從地圖移除 marker & InfoWindow
      iw.close();
      marker.setMap(null);

      // 2. 從 yellowInfoWindows 陣列移除這個 iw（可有可無，但比較乾淨）
      const iwIndex = yellowInfoWindows.indexOf(iw);
      if (iwIndex >= 0) yellowInfoWindows.splice(iwIndex, 1);

      // 3. 從 places 陣列移除對應物件
      const placeIndex = places.indexOf(p);
      if (placeIndex >= 0) places.splice(placeIndex, 1);

      // 4. 如果你有要重新算 bounds / fitBounds，也可以在這裡做（可選）
      //    目前可以先不動地圖視角，使用上比較直覺
      console.log('Place removed:', { lat: p.lat, lng: p.lng, jp: p.name, en: p.name_en });
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

    const jp = prompt('新增地點：輸入主要名稱', '');
    if (jp === null) return;

    const en = prompt('新增地點：輸入英文名稱', '');
    if (en === null) return;

    const newPlace = { lat, lng, jp, en };
    places.push(newPlace);
    createPlaceMarker(newPlace);

    console.log('New place added:', newPlace);
  }

  // 共用：實際在地圖上建立一個橘色 group（marker + circle + label + panel），並與 groups 同步
  function buildOrangeGroupOnMap(groupData) {
    const pos = { lat: groupData.lat, lng: groupData.lng };

    // 若尚未被加入 groups（例如初始化以外的情境），確保 groups 也有這筆資料
    const exists = groups.some(g =>
      Math.abs(g.lat - groupData.lat) < 1e-6 &&
      Math.abs(g.lng - groupData.lng) < 1e-6 &&
      g.name === groupData.name
    );
    if (!exists) {
      groups.push({
        name: groupData.name,
        lat: groupData.lat,
        lng: groupData.lng,
        radiusM: groupData.radiusM
      });
    }

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: svgOrangeDot,
      draggable: true,
      title: groupData.name
    });

    const labelOverlay = new OrangeLabel(new google.maps.LatLng(pos.lat, pos.lng), groupData.name, map);

    const circle = new google.maps.Circle({
      map,
      center: pos,
      radius: groupData.radiusM,
      strokeColor:'#FF7A00',
      strokeOpacity:0.9,
      strokeWeight:2,
      fillColor:'#FF7A00',
      fillOpacity:0.15
    });

    circle.bindTo('center', marker, 'position');

    const o = { name: groupData.name, marker, circle, labelOverlay };
    orangeItems.push(o);

    // 拖曳時讓 label 跟著位置移動，並同步更新 groups 中的座標
    marker.addListener('position_changed', () => {
      const currentPos = marker.getPosition();
      if (currentPos) {
        labelOverlay.setPosition(currentPos);

        const gx = groups.find(g =>
          g.name === o.name &&
          Math.abs(g.lat - groupData.lat) < 1e-6 &&
          Math.abs(g.lng - groupData.lng) < 1e-6
        );
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

    const name = prompt('新增範圍：輸入名稱', defaultName);
    if (name === null) return;

    const groupData = { name, lat, lng, radiusM: defaultRadius };

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

  // === 橘色控制面板 ===
  const control = document.createElement('div');
  control.style.cssText =
    'position:fixed;bottom:10px;right:10px;background:#fff;padding:10px;border:1px solid #ccc;border-radius:8px;max-height:60vh;overflow-y:auto;font-family:system-ui;font-size:12px;z-index:99999;';
  control.innerHTML = `<b style="font-size:13px;">Orange Radius Control</b><br>`;

  // 下載 JSON 小工具
  function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
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

  // 中間區塊：所有 group 控制列都塞這裡
  const groupsContainer = document.createElement('div');

  // 底部 footer：分隔線 + 下載按鈕
  const footer = document.createElement('div');
  footer.append(document.createElement('hr'));
  footer.append(toolbar);

  function appendOrangeControlBlock(o) {
    const block = document.createElement('div');
    block.style.margin = '8px 0';

    const headerRow = document.createElement('div');
    headerRow.style.display = 'flex';
    headerRow.style.alignItems = 'center';

    const nameEl = document.createElement('div');
    nameEl.textContent = o.name;
    nameEl.style.fontWeight = '500';
    nameEl.style.flex = '1';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.textContent = '✏️';
    editBtn.style.fontSize = '11px';
    editBtn.style.padding = '0 4px';
    editBtn.style.marginLeft = '6px';
    editBtn.style.cursor = 'pointer';
    editBtn.style.border = '1px solid #ddd';
    editBtn.style.borderRadius = '4px';
    editBtn.style.background = '#f8f8f8';

    // 點 ✏️ → 名稱變成 input，可按 Enter 確認
    editBtn.onclick = () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.value = o.name;
      input.style.fontSize = '11px';
      input.style.flex = '1';
      input.style.padding = '1px 3px';
      input.style.border = '1px solid #ccc';
      input.style.borderRadius = '3px';

      // 用 input 暫時取代 nameEl
      headerRow.replaceChild(input, nameEl);
      input.focus();
      input.select();

      const finish = (commit) => {
        let newName = o.name;
        if (commit) {
          const trimmed = input.value.trim();
          if (trimmed) newName = trimmed;
        }

        // 更新物件本身
        const oldName = o.name;
        o.name = newName;
        nameEl.textContent = newName;

        // 更新 marker title
        if (o.marker) o.marker.setTitle(newName);

        // 更新地圖上的白底 label
        if (o.labelOverlay && typeof o.labelOverlay.setText === 'function') {
          o.labelOverlay.setText(newName);
        }

        // 同步更新 groups 裡對應的名稱
        const pos = o.marker && o.marker.getPosition();
        if (pos) {
          const gx = groups.find(g =>
            g.name === oldName &&
            Math.abs(g.lat - +pos.lat().toFixed(6)) < 1e-6 &&
            Math.abs(g.lng - +pos.lng().toFixed(6)) < 1e-6
          );
          if (gx) gx.name = newName;
        }

        // 換回顯示 div
        headerRow.replaceChild(nameEl, input);

        // 讓 console 輸出的 JSON 也用新名稱
        printOrangeState();
      };

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          finish(true);
        } else if (e.key === 'Escape') {
          finish(false);
        }
      });

      // 失焦也當作確認（用現在 input 的內容）
      input.addEventListener('blur', () => finish(true));
    };

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
      const ok = confirm(`要刪除範圍「${o.name}」嗎？`);
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

      const pos = o.marker && o.marker.getPosition();
      if (pos) {
        const gIdx = groups.findIndex(g =>
          g.name === o.name &&
          Math.abs(g.lat - +pos.lat().toFixed(6)) < 1e-6 &&
          Math.abs(g.lng - +pos.lng().toFixed(6)) < 1e-6
        );
        if (gIdx >= 0) groups.splice(gIdx, 1);
      }

      // 從面板移除 UI 區塊
      block.remove();

      printOrangeState();
    };

    headerRow.append(nameEl, editBtn, deleteBtn);

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
      printOrangeState();
    };

    row.append(input, valueEl);
    block.append(headerRow, row);
    groupsContainer.append(block);
  }

  // 橘色：圓 + 滑桿控制（初始化既有 groups）
  for (const p of groups) {
    const { marker } = buildOrangeGroupOnMap(p);
    bounds.extend(marker.getPosition());
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds);

  // 控制面板組完所有區塊後，先掛 group 區塊，再掛 footer（內含下載按鈕）
  control.append(groupsContainer);
  control.append(footer);

  document.body.append(control);

  // === Console 輸出 ===
  function printOrangeState() {
    const arr = orangeItems.map(o => {
      const pos = o.marker.getPosition();
      return { name:o.name, lat:+pos.lat().toFixed(6), lng:+pos.lng().toFixed(6), radiusM:Math.round(o.circle.getRadius()) };
    });
    console.clear();
    console.log(JSON.stringify(arr, null, 2));
  }

  // 拖曳更新後重新印出
  orangeItems.forEach(o => o.marker.addListener('dragend', printOrangeState));

  printOrangeState();
})();
