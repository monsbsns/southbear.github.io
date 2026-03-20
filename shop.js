function getChatIdFromMiniApp() {
  if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
    const initDataUnsafe = window.Telegram.WebApp.initDataUnsafe;

    //console.log('initDataUnsafe: ' + initDataUnsafe);
    //console.log(initDataUnsafe);
    //console.log(initDataUnsafe.chat);
    //console.log(initDataUnsafe.chat_instance);
    //console.log(initDataUnsafe.chat_type);
    //console.log('window.Telegram.WebApp.chatInstanceId: ' + window.Telegram.WebApp.chatInstanceId);

    if (initDataUnsafe.chat) {
      const chatId = initDataUnsafe.chat.id;
      console.log("Chat ID:", chatId);
      return chatId;
    }

    if (initDataUnsafe.chat_instance) {
      const chatInstanceId = initDataUnsafe.chat_instance;
      console.log("Chat Instance ID:", chatInstanceId);
      return chatInstanceId;
    }

    console.log("Chat ID or Instance not found in initDataUnsafe.");
    return null;

  } else {
    console.error("Telegram WebApp object or initDataUnsafe not available.");
    return null;
  }
}

function toNum(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  const s = String(v).replace(/[^\d,.\-]/g, '').replace(/,/g, '.');
  return parseFloat(s) || 0;
}

function esc(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }

function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('Storage error', e); } }

async function fetchUrl(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`HTTP error! status: ${response.status}`);

  return await response.blob();//.text();
}

function parseCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      complete: (results) => resolve(results.data),
      error: (error) => reject(error)
    });
  });
}

async function loadMenu(jsonMenu, lang) {

  try {
    const menu = await jsonMenu.map((item, idx) => ({
      id: idx + 1,
      code: item.code,
      flags: item.flags,
      name: lang == 'en' ? item.name_en : item.name,
      description: lang == 'en' ? item.descr_en : item.descr,
      type: item.type,
      price: toNum(item.price),
    }));

    if (menu.length === 0)
      throw "Menu is empty";

    return menu;
  }
  catch (e) {
    throw "Menu load error: " + e.message;
  }
}

function createImgSrc(code) {
  return 'https://monsbsns.github.io/southbear.github.io/res/' + code.toLowerCase() +'.jpg?raw=true'
}

//HACK:L10N
function renderMenu(menu, menuElement) {

  const items = menu.slice().filter(i => i.flags != 0);

  menuElement.innerHTML = items.map(item => {
    const imgSrc = item.code ? createImgSrc(item.code) : 'logo.png';

    return `
        <div class="product" data-id="${item.id}">
          <div class="product-img-wrap">
            <img class="product-img" src="${imgSrc}" onclick="showImage('${imgSrc}')" alt="${esc(item.name)}">
          </div>
          <div class="product-content">
            <div class="product-name">${esc(item.name)}</div>
            <div class="product-desc">${esc(item.description)}</div>
            <div class="product-footer">
              <div class="product-price">${FMT.format(item.price)}</div>
              <div class="controls">
                <button class="remove-btn" onclick="updateCart(${item.id},-1)">−</button>
                <span id="qty-${item.id}">${cart[item.id]?.qty || 0}</span>
                <button class="add-btn" onclick="updateCart(${item.id},1)">+</button>
              </div>
            </div>
          </div>
        </div>
      `}).join('');
}

window.closeModal = function (id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
};

window.showImage = function (src) {
  if (!src) return;
  const im = document.getElementById('imageModalImg');
  im.src = src;
  document.getElementById('imageModal').classList.add('show');
};

window.closeImageModal = function () {
  const modal = document.getElementById('imageModal');
  modal.classList.remove('show');
  const im = document.getElementById('imageModalImg');
  im.src = '';
};

// -*- cart begin -*-
window.updateCart = function (id, delta) {
  const item = menuData.find(i => i.id === id);
  if (!item) return;

  addToCart(id, delta);
};

function addToCart(id, delta, garnishId = null, dressingId = null) {
  const item = menuData.find(i => i.id === id);
  if (!item) return;

  let cartKey = id;
  let itemName = item.name;
  let itemPrice = item.price;

  if (!cart[cartKey]) {
    cart[cartKey] = {
      id: cartKey,
      mainId: id,
      garnishId: garnishId,
      dressingId: dressingId,
      name: itemName,
      price: itemPrice,
      qty: 0,
      available: true
    };
  }

  cart[cartKey].qty = Math.max(0, (cart[cartKey].qty || 0) + delta);
  if (cart[cartKey].qty === 0) delete cart[cartKey];

  updateQuantityDisplays();
  save('cart', cart);
  updateCartFab();
  if (document.getElementById('cartModal').classList.contains('show')) showCartModal();
}

window.removeFromCart = function (cartKey) {
  if (cart[cartKey]) {
    cart[cartKey].qty = Math.max(0, cart[cartKey].qty - 1);
    if (cart[cartKey].qty === 0) delete cart[cartKey];
    save('cart', cart);
    updateCartFab();
    updateQuantityDisplays();
    showCartModal();
  }
};

window.duplicateCartItem = function (cartKey) {
  if (cart[cartKey]) {
    const item = cart[cartKey];
    if (item.mainId && item.garnishId) {
      addToCart(item.mainId, 1, item.garnishId);
    } else if (item.mainId && item.dressingId) {
      addToCart(item.mainId, 1, null, item.dressingId);
    } else if (item.mainId) {
      const mainItem = menuData.find(i => i.id === item.mainId);
      addToCart(item.mainId, 1);
    } else {
      addToCart(parseInt(cartKey), 1);
    }
  }
};

function updateQuantityDisplays() {
  menuData.forEach(item => {
    const qtyEl = document.getElementById(`qty-${item.id}`);
    if (qtyEl) {
      let totalQty = 0;
      Object.values(cart).forEach(cartItem => {
        if (cartItem.mainId === item.id || cartItem.id === item.id) {
          totalQty += cartItem.qty || 0;
        }
      });
      qtyEl.textContent = totalQty;
    }
  });
}

//HACK:L10N
function updateCartFab() {
  const fab = document.getElementById('cartFab');
  const count = Object.values(cart).reduce((s, i) => s + (i.qty || 0), 0);
  fab.style.display = count > 0 ? 'flex' : 'none';
  document.getElementById('cartFabCount').textContent = count || '';

  const preview = document.getElementById('cartPreview');
  const items = Object.values(cart);
  if (!items.length) {
    preview.innerHTML = '<div class="cart-preview-title">В корзине ничего нет.</div>';
    return;
  }
  const total = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);
  preview.innerHTML = `
        <div class="cart-preview-title">Корзина</div>
        ${items.map(i => `<div class="cart-preview-item"><span>${esc(i.name)} x${i.qty}</span><span>${FMT.format((i.price || 0) * i.qty)}</span></div>`).join('')}
        <div class="cart-preview-total">Итого: ${FMT.format(total)}</div>
      `;
}

//HACK:L10N
function showCartModal() {
  const items = Object.values(cart).sort((a, b) => a.id - b.id);
  const total = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);

  document.getElementById('cartModal').innerHTML = `
        <div class="modal">
          <button class="modal-close" onclick="closeModal('cartModal')">&times;</button>
          <div class="modal-title">Корзина</div>${workingHours === false ? '<br/><P style="color: red;">Сейчас не рабочие часы. Ваш заказ будет обработан сразу после открытия Мишки. Расписание работы смотрите в заголовке страницы заказов.</P><br/>' : ''}
          ${!items.length ? '<p style="text-align:center;color:var(--text-muted);">Корзина пуста</p>' : `
            <ul class="cart-list">
              ${items.map(i => `
                <li>
                  <span>${esc(i.name)} x${i.qty}</span>
                  <span style="display:flex;align-items:center;gap:8px;">
                    <button class="remove-btn" onclick="removeFromCart('${i.id}')">−</button>
                    <span style="margin:0 8px;min-width:80px;text-align:right;">${FMT.format((i.price || 0) * i.qty)}</span>
                    <button class="add-btn" onclick="duplicateCartItem('${i.id}')">+</button>
                  </span>
                </li>
              `).join('')}
            </ul>
            <div class="cart-total">Итого: ${FMT.format(total)}</div>
            <form id="orderForm" onsubmit="sendOrder(event)">
              <div class="form-group">
                <label>Имя в Telegram *</label>
                <input type="text" id="name" placeholder="@user" value="${esc(savedUserData.name || currentChatId)}" required>
              </div>
              <div class="form-group">
                <label>Телефон для связи с курьером (Вьетнам) *</label>
                <input type="tel" id="phone" placeholder="+84 или Нет для информации администратору" value="${esc(savedUserData.phone || '')}" required>
              </div>
              <div class="form-group">
                <label>Способ оплаты *</label>
                <select id="payment" required>
                  <option value="cash" ${savedUserData.payment === 'cash' ? 'selected' : ''}>Наличными курьеру</option>
                  <option value="qr" ${savedUserData.payment === 'qr' ? 'selected' : ''}>QR код (вьетнамский банк)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Адрес доставки *</label>
                <div class="geo-group">
                  <input type="text" id="address" placeholder="Введите точный адрес или используйте геолокацию" value="${esc(savedUserData.address || '')}" required>
                  <button type="button" class="geo-btn" onclick="getLocation(event)" title="Определить мое местоположение">🌐</button>
                </div>
              </div>
              <div class="form-group">
                <label>Комментарий</label>
                <textarea id="comment"  placeholder="Дополнительные пожелания или промокод">${esc(savedUserData.comment || '')}</textarea>
              </div>
              <button type="submit" class="btn-primary">Подтвердить заказ</button>
            </form>
          `}
        </div>
      `;
  document.getElementById('cartModal').classList.add('show');
}
// -*- cart end -*-

//HACK:L10N
window.getLocation = function (ev) {
  const btn = ev?.target || document.querySelector('.geo-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  if (!navigator.geolocation) {
    alert('Геолокация не поддерживается вашим браузером');
    if (btn) { btn.disabled = false; btn.textContent = '🌐'; }
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=en`);
        const data = await response.json();

        let address = '';
        if (data.address) {
          const parts = [];
          if (data.address.road) parts.push(data.address.road);
          if (data.address.house_number) parts.push(data.address.house_number);
          if (data.address.suburb || data.address.neighbourhood) parts.push(data.address.suburb || data.address.neighbourhood);
          if (data.address.city || data.address.town) parts.push(data.address.city || data.address.town);

          address = parts.length > 0 ? parts.join(', ') : data.display_name;
        } else {
          address = data.display_name || '';
        }

        const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        const finalAddress = `${address} (${coords})`;

        const addrEl = document.getElementById('address');
        if (addrEl) addrEl.value = finalAddress;
      } catch (error) {
        const addrEl = document.getElementById('address');
        const coords = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
        if (addrEl) addrEl.value = coords;
      }
      if (btn) { btn.disabled = false; btn.textContent = '🌐'; }
    },
    (error) => {
      alert('Не удалось определить местоположение. Пожалуйста, введите адрес вручную.');
      if (btn) { btn.disabled = false; btn.textContent = '🌐'; }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
};

//HACK:L10N
window.sendOrder = async function (e) {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const payment = document.getElementById('payment').value;
  const address = document.getElementById('address').value.trim();
  const comment = document.getElementById('comment').value.trim();

  if (!name || !phone || !payment || !address) {
    alert('Пожалуйста, заполните обязательные поля.');
    return;
  }

  const items = Object.values(cart);
  if (!items.length) {
    alert('Корзина пуста.');
    return;
  }

  orderCounter += 1;
  save('orderCounter', orderCounter);

  const total = items.reduce((s, i) => s + (i.price || 0) * (i.qty || 0), 0);
  let text = `@BB: Заказ #${orderCounter}\n`;
  text += `Клиент: ${name}\n`;
  text += `Телефон: ${phone}\n`;
  text += `Оплата: ${payment}\n`;
  text += `Адрес: ${address}\n`;
  if (comment) text += `Комментарий: ${comment}\n`;
  text += `\nЗаказ:\n`;
  items.forEach(i => {
    text += `• ${i.name} x${i.qty} — ${FMT.format((i.price || 0) * i.qty)}\n`;
  });
  text += `\nИтого: ${FMT.format(total)}\n`;

  //TODO: address
  const es = '';
  savedUserData = { name, phone, payment, es, comment };
  save('userData', savedUserData);

  const orderRecord = {
    id: orderCounter,
    ts: new Date().toISOString(),
    name, phone, payment, address, comment,
    items: items.map(i => ({ id: i.id, name: i.name, price: i.price, qty: i.qty })),
    total
  };
  orderHistory = orderHistory || [];
  orderHistory.unshift(orderRecord);
  save('orderHistory', orderHistory);

  try {
    const url = `https://api.telegram.org/bot${TG_TOKEN}/sendMessage`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TG_CHAT, text })
    });
  } catch (err) {
    console.warn('Telegram send failed', err);
  }

  cart = {};
  save('cart', cart);
  updateCartFab();
  closeModal('cartModal');
  alert('Ваш заказ получен. Администратор скоро свяжется с Вами.');
  //renderMenu();
};

//HACK:L10N
window.showOrderHistory = function () {
  const list = (orderHistory || []);
  document.getElementById('historyModal').innerHTML = `
        <div class="modal">
          <button class="modal-close" onclick="closeModal('historyModal')">&times;</button>
          <div class="modal-title">История заказов</div>
          ${!list.length ? '<p style="text-align:center;color:var(--text-muted);">История пуста</p>' : `
            ${list.map(o => `
              <div class="history-item">
                <div class="history-header"><span>Заказ #${o.id}</span><span>${(new Date(o.ts)).toLocaleString()}</span></div>
                <div class="history-products">
                  ${o.items.map(it => `${esc(it.name)} x${it.qty} (${FMT.format(it.price * it.qty)})`).join('<br>')}
                </div>
                <div class="history-footer">
                  <strong>${FMT.format(o.total)}</strong>
                  <button class="btn-repeat" onclick='repeatOrder(${o.id})'>Повторить</button>
                </div>
              </div>
            `).join('')}
          `}
        </div>
      `;
  document.getElementById('historyModal').classList.add('show');
};

//HACK:L10N
window.repeatOrder = function (orderId) {
  const order = (orderHistory || []).find(o => o.id === orderId);
  if (!order) return alert('Заказ не найден');
  cart = {};
  order.items.forEach(i => cart[i.id] = { id: i.id, name: i.name, price: i.price, qty: i.qty, available: true });
  save('cart', cart);
  closeModal('historyModal');
  //renderMenu();
  showCartModal();
};
