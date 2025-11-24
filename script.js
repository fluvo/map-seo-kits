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
  for (const p of places) {
    const pos = { lat: p.lat, lng: p.lng };

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: svgYellowPin,
      title: `${p.en} (${p.jp})`
    });

    const iw = new google.maps.InfoWindow({
      content: `<b style="font-size:14px;color:#7a5">${p.jp}</b><div>${p.en}</div>`
    });

    // 初始：自動打開
    iw.open({ map, anchor: marker });

    let isOpen = true;

    // 點黃色圖標：toggle 開 / 關
    marker.addListener('click', () => {
      if (isOpen) {
        iw.close();
      } else {
        iw.open({ map, anchor: marker });
      }
      isOpen = !isOpen;
    });

    yellowInfoWindows.push(iw);
    bounds.extend(pos);
  }

  // 橘色：圓 + 滑桿控制
  for (const p of groups) {
    const pos = { lat: p.lat, lng: p.lng };

    const marker = new google.maps.Marker({
      map,
      position: pos,
      icon: svgOrangeDot,
      draggable: true,
      title: p.name
    });

    // ★ 新增：白底＋陰影的小 Label，貼在橘色點上方
    const labelOverlay = new OrangeLabel(new google.maps.LatLng(pos.lat, pos.lng), p.name, map);

    const circle = new google.maps.Circle({
      map, center: pos, radius: p.radiusM,
      strokeColor:'#FF7A00', strokeOpacity:0.9, strokeWeight:2,
      fillColor:'#FF7A00', fillOpacity:0.15
    });
    circle.bindTo('center', marker, 'position');

    // 拖曳時讓 label 跟著位置移動
    marker.addListener('position_changed', () => {
      const currentPos = marker.getPosition();
      if (currentPos) labelOverlay.setPosition(currentPos);
    });

    orangeItems.push({ name: p.name, marker, circle, labelOverlay });
    bounds.extend(pos);
  }
  if (!bounds.isEmpty()) map.fitBounds(bounds);

  // === 橘色控制面板 ===
  const control = document.createElement('div');
  control.style.cssText =
    'position:fixed;bottom:10px;right:10px;background:#fff;padding:10px;border:1px solid #ccc;border-radius:8px;max-height:60vh;overflow-y:auto;font-family:system-ui;font-size:12px;z-index:99999;';
  control.innerHTML = `<b style="font-size:13px;">:large_orange_circle: Orange Radius Control</b><br>`;

  for (const o of orangeItems) {
    const block = document.createElement('div');
    block.style.margin = '8px 0';

    // 名稱在上面一行
    const nameEl = document.createElement('div');
    nameEl.textContent = o.name;
    nameEl.style.fontWeight = '500';
    nameEl.style.marginBottom = '2px';

    // slider + 距離數值（右側）
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';

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
    valueEl.style.minWidth = '48px'; // 避免數字跳動寬度

    input.oninput = () => {
      const val = Math.round(Number(input.value));
      o.circle.setRadius(val);
      valueEl.textContent = `${val}m`;
      printOrangeState();
    };

    row.append(input, valueEl);
    block.append(nameEl, row);
    control.append(block);
  }

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
