// components.js
import { 
  auth, onAuthStateChanged, signOut, db, doc, getDoc, setDoc,
  updateDoc, serverTimestamp, collection, addDoc, query, where, onSnapshot,
  deleteDoc, getDocs,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification,
  signInWithPopup, googleProvider
} from './firebase-config.js';

// ================================================================
// ✅ নোটিফিকেশন: অ্যাডমিনের পাঠানো আনরিড মেসেজ ট্র্যাক করা (Realtime)
// ================================================================
let unreadAdminMessages = [];
let displayMessages = [];
let adminMessageUnsubscribe = null;

function startAdminMessageListener(user) {
  if (adminMessageUnsubscribe) {
    adminMessageUnsubscribe();
    adminMessageUnsubscribe = null;
  }

  if (!user) {
    updateNotificationBadge(0);
    updateNotificationList([]);
    return;
  }

  const q = query(
    collection(db, 'messages'),
    where('toUserId', '==', user.uid),
    where('fromUserId', '==', 'admin'),
    where('read', '==', false)
  );

  adminMessageUnsubscribe = onSnapshot(q, (snapshot) => {
    unreadAdminMessages = [];
    snapshot.forEach((doc) => {
      unreadAdminMessages.push({ id: doc.id, ...doc.data() });
    });
    updateNotificationBadge(unreadAdminMessages.length);
    if (displayMessages.length > 0) {
      // ড্রপডাউন খোলা থাকলে নতুন মেসেজ যোগ করি না (পরে দেখাবে)
    } else {
      updateNotificationList(unreadAdminMessages);
    }
  }, (error) => {
    console.error('Admin messages listener error:', error);
  });
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notificationBadge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

function updateNotificationList(messages) {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (!messages || messages.length === 0) {
    list.innerHTML = '<div class="p-4 text-sm text-gray-500 text-center">No new messages from admin.</div>';
    return;
  }

  let html = '';
  messages.slice(0, 10).forEach((msg) => {
    const preview = msg.content?.length > 40 ? msg.content.slice(0, 40) + '...' : msg.content;
    const time = msg.timestamp?.toDate?.()?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) || '';
    html += `
      <a href="messages.html" class="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs flex-shrink-0">
            <i class="fas fa-headset"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 text-sm">Admin Support</p>
            <p class="text-sm text-gray-600 truncate">${preview}</p>
            <p class="text-xs text-gray-400">${time}</p>
          </div>
          <span class="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1.5"></span>
        </div>
      </a>
    `;
  });

  if (messages.length > 10) {
    html += `<a href="messages.html" class="block px-4 py-2 text-center text-sm text-blue-600 hover:bg-gray-50">View all ${messages.length} messages</a>`;
  }

  list.innerHTML = html;
}

async function markAllAdminMessagesRead() {
  const user = auth.currentUser;
  if (!user || unreadAdminMessages.length === 0) return;

  try {
    const promises = unreadAdminMessages.map((msg) =>
      updateDoc(doc(db, 'messages', msg.id), {
        read: true,
        readAt: serverTimestamp(),
      })
    );
    await Promise.all(promises);
  } catch (err) {
    console.error('Error marking messages as read:', err);
  }
}

// ================================================================
// ✅ NOTIFICATION TOGGLE (Mobile-optimized)
// ================================================================
window.toggleNotifications = function() {
  const dropdown = document.getElementById('notificationDropdown');
  if (!dropdown) return;
  const isOpening = dropdown.classList.contains('hidden');
  if (isOpening) {
    displayMessages = [...unreadAdminMessages];
    updateNotificationList(displayMessages);
    dropdown.classList.remove('hidden');
    document.body.classList.add('dropdown-open');
    dropdown.style.animation = 'dropdownFade 0.2s ease';
    markAllAdminMessagesRead();
  } else {
    displayMessages = [];
    dropdown.classList.add('hidden');
    document.body.classList.remove('dropdown-open');
  }
};

// ================================================================
// ✅ TOAST NOTIFICATION
// ================================================================
window.showToast = function(message, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      display: flex; flex-direction: column; gap: 12px;
      max-width: 420px; width: 100%; pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const icons = { 
    success: 'fa-check-circle', 
    error: 'fa-exclamation-circle', 
    warning: 'fa-exclamation-triangle',
    info: 'fa-info-circle'
  };
  const colors = {
    success: '#34C759',
    error: '#FF3B30',
    warning: '#FF9500',
    info: '#007AFF'
  };

  toast.className = `toast ${type}`;
  toast.style.cssText = `
    padding: 16px 20px; border-radius: 16px;
    background: rgba(255,255,255,0.95); backdrop-filter: blur(12px);
    border: 1px solid rgba(255,255,255,0.8);
    box-shadow: 0 12px 48px rgba(0,0,0,0.12);
    font-size: 0.95rem; font-weight: 500; color: #1c1c1e;
    transform: translateX(calc(100% + 40px));
    animation: slideIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    display: flex; align-items: center; gap: 14px;
    pointer-events: auto; border-left: 4px solid ${colors[type] || '#007AFF'};
    width: 100%;
  `;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.success}" style="font-size:1.3rem; color:${colors[type] || '#007AFF'}; flex-shrink:0;"></i>
    <span style="flex:1;">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#8e8e93;cursor:pointer;font-size:1.1rem;">
      <i class="fas fa-times"></i>
    </button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards';
    setTimeout(() => toast.remove(), 450);
  }, 4500);
};

const toastStyles = document.createElement('style');
toastStyles.textContent = `
  @keyframes slideIn {
    to { transform: translateX(0); }
  }
  @keyframes slideOut {
    to { transform: translateX(calc(100% + 40px)); opacity: 0; }
  }
`;
document.head.appendChild(toastStyles);

// ================================================================
// ✅ CART BADGE (রিয়েল-টাইম আপডেটের জন্য পৃথক ফাংশন)
// ================================================================
export function updateCartBadge() {
  const cartBadge = document.getElementById('cartCount');
  if (!cartBadge) {
    console.warn('⚠️ cartCount element not found in DOM');
    return;
  }
  try {
    const cart = JSON.parse(localStorage.getItem('cart')) || [];
    const totalQty = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
    cartBadge.textContent = totalQty;
    cartBadge.style.display = totalQty > 0 ? 'inline-flex' : 'none';
  } catch (e) {
    cartBadge.textContent = '0';
    cartBadge.style.display = 'none';
    console.error('Badge update error:', e);
  }
}

// ================================================================
// ✅ MOBILE MENU TOGGLE
// ================================================================
window.toggleMobileMenu = function() {
  const menu = document.getElementById('mobileMenu');
  const icon = document.getElementById('hamburgerIcon');
  if (menu) {
    const isOpen = !menu.classList.contains('hidden');
    menu.classList.toggle('hidden');
    if (icon) {
      icon.classList.toggle('fa-bars');
      icon.classList.toggle('fa-times');
    }
    if (!isOpen) {
      menu.style.maxHeight = '0';
      menu.style.opacity = '0';
      setTimeout(() => {
        menu.style.maxHeight = '500px';
        menu.style.opacity = '1';
      }, 10);
    } else {
      menu.style.maxHeight = '0';
      menu.style.opacity = '0';
    }
  }
};

// ================================================================
// ✅ CONTACT MODAL (NEW)
// ================================================================
function renderContactModal() {
  if (document.getElementById('contactModal')) return;

  const modalHTML = `
    <div id="contactModal" class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[500] hidden p-4">
      <div class="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-2xl font-bold text-gray-900">Contact Us</h3>
          <button onclick="window.closeContactModal()" class="text-gray-400 hover:text-gray-600 text-2xl transition-colors" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <p class="text-gray-500 text-sm mb-4">Send us a message and we'll respond as soon as possible.</p>
        <form id="contactModalForm" class="space-y-4">
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Your Name *</label>
            <input type="text" id="contactModalName" required class="form-input" placeholder="John Doe" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Email Address *</label>
            <input type="email" id="contactModalEmail" required class="form-input" placeholder="john@example.com" />
          </div>
          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Message *</label>
            <textarea id="contactModalMessage" rows="5" required class="form-input" placeholder="Write your message..."></textarea>
          </div>
          <button type="submit" class="btn-primary w-full justify-center" id="contactModalSubmitBtn">
            <i class="fas fa-paper-plane"></i> Send Message
          </button>
          <div id="contactModalError" class="text-red-500 text-sm hidden text-center"></div>
        </form>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);

  const form = document.getElementById('contactModalForm');
  const submitBtn = document.getElementById('contactModalSubmitBtn');
  const errorDiv = document.getElementById('contactModalError');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('contactModalName').value.trim();
    const email = document.getElementById('contactModalEmail').value.trim();
    const message = document.getElementById('contactModalMessage').value.trim();

    if (!name || !email || !message) {
      errorDiv.textContent = 'All fields are required.';
      errorDiv.classList.remove('hidden');
      return;
    }
    errorDiv.classList.add('hidden');
    setLoading(submitBtn, true, 'Sending...');

    try {
      await addDoc(collection(db, 'contactMessages'), {
        name,
        email,
        message,
        timestamp: serverTimestamp(),
      });
      window.showToast('✅ Message sent! We\'ll get back to you soon.', 'success');
      form.reset();
      window.closeContactModal();
    } catch (err) {
      errorDiv.textContent = err.message;
      errorDiv.classList.remove('hidden');
      window.showToast('⚠️ Failed to send message. Please try again.', 'error');
    } finally {
      setLoading(submitBtn, false);
    }
  });

  document.getElementById('contactModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) window.closeContactModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') window.closeContactModal();
  });
}

window.openContactModal = function() {
  const modal = document.getElementById('contactModal');
  if (modal) {
    modal.classList.remove('hidden');
    document.getElementById('contactModalName').focus();
  }
};

window.closeContactModal = function() {
  const modal = document.getElementById('contactModal');
  if (modal) modal.classList.add('hidden');
};

// ================================================================
// ✅ HANDLE CONTACT CLICK
// ================================================================
window.handleContactClick = function(e) {
  e.preventDefault();
  const isIndexPage = window.location.pathname.endsWith('index.html') || 
                       window.location.pathname === '/' || 
                       window.location.pathname.endsWith('/');
  
  if (isIndexPage) {
    const contactSection = document.getElementById('contact');
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: 'smooth' });
    } else {
      window.openContactModal();
    }
  } else {
    window.openContactModal();
  }
};

// ================================================================
// ✅ SEARCH DROPDOWN
// ================================================================
let searchDropdownOpen = false;
let searchProducts = [];
let searchUnsubscribe = null;

function toggleSearchDropdown() {
  const dropdown = document.getElementById('searchDropdown');
  if (!dropdown) return;
  const isOpening = dropdown.classList.contains('hidden');
  if (isOpening) {
    dropdown.classList.remove('hidden');
    document.body.classList.add('dropdown-open');
    setTimeout(() => {
      const input = document.getElementById('searchInput');
      if (input) input.focus();
    }, 100);
    if (searchProducts.length === 0) {
      loadSearchProducts();
    }
  } else {
    dropdown.classList.add('hidden');
    document.body.classList.remove('dropdown-open');
    const results = document.getElementById('searchResults');
    if (results) results.innerHTML = '';
    const input = document.getElementById('searchInput');
    if (input) input.value = '';
  }
  searchDropdownOpen = !isOpening;
}

function loadSearchProducts() {
  if (searchUnsubscribe) {
    searchUnsubscribe();
    searchUnsubscribe = null;
  }
  searchUnsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
    searchProducts = [];
    snapshot.forEach(doc => {
      searchProducts.push({ id: doc.id, ...doc.data() });
    });
    const input = document.getElementById('searchInput');
    if (input && input.value.trim().length > 0) {
      performSearch(input.value.trim());
    }
  }, (error) => {
    console.error('Search products listener error:', error);
  });
}

function performSearch(query) {
  const resultsContainer = document.getElementById('searchResults');
  if (!resultsContainer) return;
  if (!query || query.trim().length === 0) {
    resultsContainer.innerHTML = `<div class="p-4 text-sm text-gray-400 text-center">Type to search products...</div>`;
    return;
  }
  const q = query.trim().toLowerCase();
  const filtered = searchProducts.filter(p => {
    const name = (p.name || '').toLowerCase();
    const desc = (p.desc || p.description || '').toLowerCase();
    const category = (p.category || '').toLowerCase();
    return name.includes(q) || desc.includes(q) || category.includes(q);
  });

  if (filtered.length === 0) {
    resultsContainer.innerHTML = `<div class="p-4 text-sm text-gray-400 text-center">No products found matching "<strong>${query}</strong>"</div>`;
    return;
  }

  let html = '';
  filtered.slice(0, 8).forEach(p => {
    const price = p.price ? '$' + p.price.toFixed(2) : '';
    html += `
      <a href="product-detail.html?id=${p.id}" class="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 transition-colors">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0">
            <i class="fas fa-file-code"></i>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-900 text-sm truncate">${p.name}</p>
            <p class="text-xs text-gray-500 truncate">${p.category || 'Uncategorized'}</p>
          </div>
          ${price ? `<span class="text-sm font-semibold text-blue-600">${price}</span>` : ''}
        </div>
      </a>
    `;
  });
  if (filtered.length > 8) {
    html += `<a href="get-new-website.html" class="block px-4 py-2 text-center text-sm text-blue-600 hover:bg-gray-50">View all ${filtered.length} results →</a>`;
  }
  resultsContainer.innerHTML = html;
}

// ================================================================
// ✅ LANDING NAVBAR
// ================================================================
function setupLandingNavbar() {
  const nav = document.getElementById('mainNavbar');
  if (!nav) return;

  const isIndexPage =
    window.location.pathname.endsWith('index.html') ||
    window.location.pathname === '/' ||
    window.location.pathname.endsWith('/') ||
    window.location.pathname === '';

  if (!isIndexPage) {
    nav.classList.remove('nav-transparent');
    nav.classList.add('nav-solid');
    return;
  }

  const SCROLL_THRESHOLD = 40;

  const updateNav = () => {
    if (window.scrollY > SCROLL_THRESHOLD) {
      nav.classList.remove('nav-transparent');
      nav.classList.add('nav-solid');
    } else {
      nav.classList.remove('nav-solid');
      nav.classList.add('nav-transparent');
    }
  };

  nav.classList.remove('nav-solid', 'glass', 'shadow-sm', 'border-b', 'border-gray-100/30');
  nav.classList.add('nav-transparent');
  updateNav();

  window.addEventListener('scroll', updateNav, { passive: true });
}

// ================================================================
// ✅ NAVBAR
// ================================================================
export function renderNavbar() {
  renderContactModal();

  const navbarHTML = `
    <nav id="mainNavbar" class="fixed top-0 left-0 w-full z-50 h-[72px] md:h-[80px] flex items-center px-4 sm:px-8 lg:px-12 transition-all duration-300 ease-out glass shadow-sm border-b border-gray-100/30">
      <div class="max-w-7xl mx-auto w-full flex items-center justify-between">
        <a href="index.html" class="flex items-center gap-2.5 text-2xl font-bold text-gray-900 hover:opacity-80 transition-opacity">
          <img src="https://res.cloudinary.com/zmoyykj7/image/upload/v1785180242/a6xbhrnjvb33c5ic6yyr.png" alt="CodeCureBD Logo" class="logo-img h-8 w-auto" />
          <span class="logo-text tracking-tight">CodeCure<span class="gradient-text">BD</span></span>
        </a>
        
        <div class="hidden md:flex items-center gap-1 lg:gap-2">
          <a href="index.html" class="nav-link px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50/50">Home</a>
          <a href="get-new-website.html" class="nav-link px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50/50">Store</a>
          <a href="fix-website.html" class="nav-link px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50/50">Fix</a>
          <a href="#" onclick="window.handleContactClick(event)" class="nav-link px-3 py-2 text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50/50">Contact</a>
        </div>

        <div class="flex items-center gap-2 md:gap-3">
          <div class="relative">
            <button onclick="window.toggleSearchDropdown()" class="w-10 h-10 rounded-full hover:bg-gray-100/60 flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors text-lg" title="Search products">
              <i class="fas fa-search"></i>
            </button>
            <div id="searchDropdown" class="absolute right-0 mt-2 w-96 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-100 hidden z-50 overflow-hidden">
              <div class="p-4 border-b border-gray-100">
                <div class="relative">
                  <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input type="text" id="searchInput" placeholder="Search products..." class="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition text-sm" autocomplete="off" />
                </div>
              </div>
              <div id="searchResults" class="max-h-[350px] overflow-y-auto">
                <div class="p-4 text-sm text-gray-400 text-center">Type to search products...</div>
              </div>
              <div class="p-2 border-t border-gray-100">
                <a href="get-new-website.html" class="block text-center text-sm text-blue-600 hover:bg-gray-50 py-2 rounded-lg transition-colors">Browse all products →</a>
              </div>
            </div>
          </div>

          <div class="relative">
            <button id="cartBtn" onclick="window.toggleCart()" class="w-10 h-10 rounded-full hover:bg-gray-100/60 flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors text-lg relative" title="Cart">
              <i class="fas fa-shopping-cart"></i>
              <span id="cartCount" class="cart-badge" style="display:none;">0</span>
            </button>
            <div id="cartPopupContainer"></div>
          </div>

          <div id="authRequiredActions" class="flex items-center gap-2 md:gap-3" style="display:none;">
            <div class="relative">
              <button onclick="window.toggleNotifications()" class="w-10 h-10 rounded-full hover:bg-gray-100/60 flex items-center justify-center text-gray-600 hover:text-blue-600 transition-colors text-lg relative" aria-label="Notifications">
                <i class="fas fa-bell"></i>
                <span id="notificationBadge" class="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 hidden">
                  0
                </span>
              </button>
              <div id="notificationDropdown" class="absolute right-0 mt-2 w-80 max-w-[90vw] bg-white rounded-2xl shadow-xl border border-gray-100 hidden max-h-[70vh] overflow-y-auto z-50">
                <div class="p-4 font-semibold border-b text-gray-900 flex items-center justify-between">
                  <span><i class="fas fa-bell mr-2 text-blue-500"></i>Notifications</span>
                  <span class="text-xs font-normal text-gray-400" id="notifCountLabel">0 new</span>
                </div>
                <div id="notificationList" class="divide-y divide-gray-50">
                  <div class="p-4 text-sm text-gray-500 text-center">Loading...</div>
                </div>
                <div class="p-2 border-t">
                  <a href="messages.html" class="block text-center text-sm text-blue-600 hover:bg-gray-50 py-2 rounded-lg transition-colors">View all messages</a>
                </div>
              </div>
            </div>
          </div>
          
          <div id="auth-loading" class="flex items-center gap-2">
            <div class="w-16 h-8 bg-gray-200 rounded-full animate-pulse"></div>
            <div class="w-24 h-10 bg-gray-200 rounded-full animate-pulse hidden md:block"></div>
          </div>

          <div id="auth-buttons" class="hidden flex items-center gap-2">
            <button onclick="window.openAuthModal('signin')" class="text-sm font-medium text-gray-600 hover:text-blue-600 transition-colors px-3 py-2 rounded-lg hover:bg-blue-50/50">Sign In</button>
            <button onclick="window.openAuthModal('signup')" class="btn-primary text-sm py-2.5 px-5 shadow-md shadow-blue-500/20 hover:shadow-blue-500/30">
              <i class="fas fa-rocket text-xs"></i> Get Started
            </button>
          </div>

          <div id="profile-section" class="relative hidden">
            <button class="profile-avatar w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-sm flex items-center justify-center hover:scale-105 transition-transform shadow-md shadow-blue-500/20" id="profileAvatar">U</button>
            <div class="dropdown-menu" id="dropdownMenu">
              <a href="my-profile.html" class="hover:bg-blue-50/50"><i class="fas fa-user mr-3 text-gray-400"></i> My Profile</a>
              <a href="my-orders.html" class="hover:bg-blue-50/50"><i class="fas fa-box mr-3 text-gray-400"></i> My Orders</a>
              <a href="my-fix-requests.html" class="hover:bg-blue-50/50"><i class="fas fa-tools mr-3 text-gray-400"></i> Fix Requests</a>
              <a href="messages.html" class="hover:bg-blue-50/50"><i class="fas fa-comment-dots mr-3 text-gray-400"></i> Support Chat</a>
              <a href="settings.html" class="hover:bg-blue-50/50"><i class="fas fa-cog mr-3 text-gray-400"></i> Settings</a>
              <a href="admin-panel.html" id="adminPanelLink" class="hidden hover:bg-blue-50/50"><i class="fas fa-shield-alt mr-3 text-blue-500"></i> Admin Panel</a>
              <hr class="my-1 border-gray-100" />
              <a href="#" onclick="window.handleLogout()" class="text-red-500 hover:bg-red-50/50"><i class="fas fa-sign-out-alt mr-3 text-red-400"></i> Logout</a>
            </div>
          </div>

          <button onclick="window.toggleMobileMenu()" class="md:hidden w-10 h-10 rounded-full hover:bg-gray-100/60 flex items-center justify-center text-gray-700 text-2xl transition-colors" aria-label="Toggle menu">
            <i class="fas fa-bars" id="hamburgerIcon"></i>
          </button>
        </div>
      </div>
    </nav>

    <div id="mobileMenu" class="fixed top-[72px] md:top-[80px] left-0 w-full bg-white/95 backdrop-blur-lg shadow-lg z-40 hidden md:hidden overflow-hidden transition-all duration-300 border-b border-gray-100/30" style="max-height:0; opacity:0;">
      <div class="flex flex-col p-4 gap-1">
        <a href="index.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors">Home</a>
        <a href="get-new-website.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors">Store</a>
        <a href="fix-website.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors">Fix</a>
        <a href="#" onclick="window.handleContactClick(event)" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors">Contact</a>
        <hr class="my-2 border-gray-100" />
        <a href="my-profile.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors"><i class="fas fa-user mr-3"></i> Profile</a>
        <a href="my-orders.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors"><i class="fas fa-box mr-3"></i> Orders</a>
        <a href="my-fix-requests.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors"><i class="fas fa-tools mr-3"></i> Fix Requests</a>
        <a href="messages.html" class="nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-gray-700 transition-colors"><i class="fas fa-comment-dots mr-3"></i> Support Chat</a>
        <a href="admin-panel.html" id="mobileAdminPanelLink" class="hidden nav-link py-3 px-4 rounded-xl hover:bg-blue-50/50 font-medium text-blue-600 transition-colors"><i class="fas fa-shield-alt mr-3"></i> Admin Panel</a>
        <a href="#" onclick="window.handleLogout()" class="nav-link py-3 px-4 rounded-xl hover:bg-red-50/50 font-medium text-red-500 transition-colors"><i class="fas fa-sign-out-alt mr-3"></i> Logout</a>
      </div>
    </div>
  `;
  
  const placeholder = document.getElementById('navbar-placeholder');
  if (placeholder) {
    placeholder.innerHTML = navbarHTML;
  }

  setupLandingNavbar();

  const avatar = document.getElementById('profileAvatar');
  const dropdown = document.getElementById('dropdownMenu');
  if (avatar) {
    avatar.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('show');
    });
  }

  document.addEventListener('click', (e) => {
    if (avatar && !avatar.contains(e.target) && !dropdown.contains(e.target)) {
      dropdown.classList.remove('show');
    }
  });

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      performSearch(this.value);
    });
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstResult = document.querySelector('#searchResults a');
        if (firstResult) {
          firstResult.click();
        } else {
          const query = this.value.trim();
          if (query) {
            window.location.href = `get-new-website.html?search=${encodeURIComponent(query)}`;
          }
        }
      }
    });
  }

  updateCartBadge();

  onAuthStateChanged(auth, (user) => {
    if (user) {
      syncCart(user.uid);
    }
  });
  
  renderCartPopup();

  window.toggleSearchDropdown = toggleSearchDropdown;

  window.addEventListener('beforeunload', () => {
    if (searchUnsubscribe) {
      searchUnsubscribe();
      searchUnsubscribe = null;
    }
  });
}

// ================================================================
// ✅ CART POPUP
// ================================================================
let cartPopupRendered = false;

export function renderCartPopup() {
  const container = document.getElementById('cartPopupContainer');
  if (!container) return;
  
  if (cartPopupRendered) {
    updateCartPopupUI();
    return;
  }

  const popupHTML = `
    <div class="cart-popup hidden" id="cartPopup">
      <div class="cart-popup-header">
        <span class="cart-popup-title"><i class="fas fa-shopping-bag mr-2"></i> Your Cart</span>
      </div>
      <div id="cartPopupItems" class="cart-popup-items">
        <div class="cart-empty">Your cart is empty.</div>
      </div>
      <div class="cart-popup-footer">
        <div class="cart-popup-total">
          <span>Total:</span>
          <span id="cartPopupTotal">$0</span>
        </div>
        <button onclick="window.cartCheckout()" class="btn-primary w-full justify-center cart-checkout-btn">
          <i class="fas fa-lock"></i> Checkout
        </button>
      </div>
    </div>
  `;

  container.innerHTML = popupHTML;
  cartPopupRendered = true;
  updateCartPopupUI();
}

export function toggleCart() {
  const popup = document.getElementById('cartPopup');
  if (!popup) return;
  const isOpening = popup.classList.contains('hidden');
  if (isOpening) {
    popup.classList.remove('hidden');
    document.body.classList.add('dropdown-open');
    updateCartPopupUI();
  } else {
    popup.classList.add('hidden');
    document.body.classList.remove('dropdown-open');
  }
}
window.toggleCart = toggleCart;

window.removeFromCart = function(index) {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  cart.splice(index, 1);
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartPopupUI();
  updateCartBadge();
  const user = auth.currentUser;
  if (user) {
    updateCartInFirestore(user.uid, cart);
  }
};

window.cartCheckout = function() {
  const popup = document.getElementById('cartPopup');
  if (popup) popup.classList.add('hidden');
  document.body.classList.remove('dropdown-open');
  if (typeof window.checkout === 'function') {
    window.checkout();
  } else {
    window.location.href = 'get-new-website.html?checkout=1';
  }
};

window.addToCart = async function(productId, productName, productPrice, productImage = '') {
  if (!productId || !productName) {
    window.showToast('⚠️ Product information missing.', 'error');
    return;
  }

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  const existing = cart.find(item => item.id === productId);
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      id: productId,
      name: productName,
      price: productPrice || 0,
      imageUrl: productImage || '',
      quantity: 1
    });
  }

  localStorage.setItem('cart', JSON.stringify(cart));

  updateCartBadge();
  updateCartPopupUI();

  setTimeout(() => {
    updateCartBadge();
    updateCartPopupUI();
  }, 100);

  const user = auth.currentUser;
  if (user) {
    await updateCartInFirestore(user.uid, cart);
  }

  window.showToast(`✅ "${productName}" added to cart`, 'success');
};

// ================================================================
// ✅ FOOTER
// ================================================================
export function renderFooter() {
  const footerHTML = `
    <footer class="glass border-t border-gray-200/30 py-12 px-6 sm:px-8 lg:px-12 mt-auto">
      <div class="max-w-7xl mx-auto">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div class="text-center md:text-left">
            <div class="flex items-center justify-center md:justify-start gap-2">
              <img src="https://res.cloudinary.com/zmoyykj7/image/upload/v1785180242/a6xbhrnjvb33c5ic6yyr.png" alt="CodeCureBD Logo" class="logo-img h-8 w-auto" />
              <span class="font-bold text-xl text-gray-800">CodeCure<span class="gradient-text">BD</span></span>
            </div>
            <p class="text-sm text-gray-500 mt-2 max-w-xs mx-auto md:mx-0">Professional web development, fixing, and maintenance – tailored for your business.</p>
          </div>
          <div class="text-center md:text-left">
            <h4 class="font-semibold text-gray-700 mb-3">Quick Links</h4>
            <div class="space-y-1 text-sm">
              <a href="index.html" class="block hover:text-blue-600 transition-colors">Home</a>
              <a href="get-new-website.html" class="block hover:text-blue-600 transition-colors">Store</a>
              <a href="fix-website.html" class="block hover:text-blue-600 transition-colors">Fix</a>
              <a href="messages.html" class="block hover:text-blue-600 transition-colors">Support Chat</a>
            </div>
          </div>
          <div class="text-center md:text-left">
            <h4 class="font-semibold text-gray-700 mb-3">Contact</h4>
            <div class="space-y-1 text-sm text-gray-500">
              <a href="mailto:nopqrshov337@gmail.com" class="block hover:text-blue-600 transition-colors">
                <i class="fas fa-envelope mr-2 w-4"></i> nopqrshov337@gmail.com
              </a>
              <a href="tel:+8801350141762" class="block hover:text-blue-600 transition-colors">
                <i class="fas fa-phone mr-2 w-4"></i> +880 1350-141762
              </a>
              <span class="block"><i class="fas fa-map-marker-alt mr-2 w-4"></i> Dhaka, Bangladesh</span>
            </div>
          </div>
          <div class="text-center">
            <h4 class="font-semibold text-gray-700 mb-3">Follow Us</h4>
            <div class="flex flex-wrap justify-center gap-3">
              <a href="https://github.com/shovon337" target="_blank" class="social-icon" aria-label="GitHub"><i class="fab fa-github"></i></a>
              <a href="https://www.linkedin.com/in/shovon-s-mind-67aa4b260/" target="_blank" class="social-icon" aria-label="LinkedIn"><i class="fab fa-linkedin-in"></i></a>
              <a href="https://www.facebook.com/profile.php?id=61592614590327" target="_blank" class="social-icon" aria-label="Facebook"><i class="fab fa-facebook-f"></i></a>
              <a href="https://www.instagram.com/codecurebd/" target="_blank" class="social-icon" aria-label="Instagram"><i class="fab fa-instagram"></i></a>
              <a href="https://www.youtube.com/channel/UCstUaZ9xdqqjaAz3zkO6XJQ" target="_blank" class="social-icon" aria-label="YouTube"><i class="fab fa-youtube"></i></a>
            </div>
          </div>
        </div>
        <div class="border-t border-gray-200/30 mt-8 pt-6 text-center text-sm text-gray-400">
          &copy; 2026 CodeCureBD. All rights reserved.
        </div>
      </div>
    </footer>
  `;
  const placeholder = document.getElementById('footer-placeholder');
  if (placeholder) {
    placeholder.innerHTML = footerHTML;
  }
}

export function renderCartSidebar() {
  if (!cartPopupRendered) renderCartPopup();
}

export function updateCartUI() {
  updateCartPopupUI();
}

function updateCartPopupUI() {
  const itemsContainer = document.getElementById('cartPopupItems');
  const totalEl = document.getElementById('cartPopupTotal');
  if (!itemsContainer || !totalEl) return;

  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (cart.length === 0) {
    itemsContainer.innerHTML = `<div class="cart-empty">Your cart is empty.</div>`;
    totalEl.textContent = '$0';
    return;
  }

  let total = 0;
  let html = '';
  cart.forEach((item, index) => {
    const qty = item.quantity || 1;
    const price = item.price || 0;
    const subtotal = qty * price;
    total += subtotal;
    html += `
      <div class="cart-popup-item">
        <div class="cart-item-info">
          <span class="cart-item-name">${item.name}</span>
          <span class="cart-item-price">$${subtotal.toFixed(2)}</span>
        </div>
        <button onclick="window.removeFromCart(${index})" class="cart-item-remove" title="Remove item">
          <i class="fas fa-times"></i>
        </button>
      </div>
    `;
  });

  itemsContainer.innerHTML = html;
  totalEl.textContent = `$${total.toFixed(2)}`;
}

export function setLoading(button, isLoading, originalText = null) {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button._originalText = originalText || button.innerHTML;
    button.innerHTML = `<span class="spinner"></span> Loading...`;
  } else {
    button.disabled = false;
    if (button._originalText) {
      button.innerHTML = button._originalText;
      delete button._originalText;
    }
  }
}

// ================================================================
// ✅ PAYMENT MODAL & CHECKOUT (ADVANCE & FULL PAYMENT SYSTEM ADDED)
// ================================================================
let _paymentSettings = {};
let _paymentOrderTotalUSD = 0;
let _pendingCheckoutData = null;
let _duePaymentData = null; // For due payment

const DEFAULT_USDT_ADDRESS = '0x0e24bd75c45be9d0e43bddff6553dbd046a12840';
const QR_IMAGE_PATH = './Deposit USDT.jpeg';

window.openQrZoom = function(imgSrc) {
  const modal = document.getElementById('qrZoomModal');
  const img = document.getElementById('qrZoomImage');
  if (!modal || !img) return;
  img.src = imgSrc || QR_IMAGE_PATH;
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
};

window.closeQrZoom = function() {
  const modal = document.getElementById('qrZoomModal');
  if (!modal) return;
  modal.classList.add('hidden');
  modal.style.display = 'none';
  document.body.style.overflow = '';
};

window.downloadQrImage = function() {
  const img = document.getElementById('qrZoomImage');
  if (!img) return;
  const link = document.createElement('a');
  link.href = img.src;
  link.download = 'USDT_Deposit_QR.png';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast('✅ QR code downloaded!', 'success');
};

function renderQrZoomModal() {
  if (document.getElementById('qrZoomModal')) return;
  const modalHTML = `
    <div id="qrZoomModal" class="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[9999] hidden" style="display:none;" onclick="if(event.target===this) window.closeQrZoom()">
      <div class="relative max-w-[95vw] max-h-[95vh] bg-white rounded-2xl p-4 shadow-2xl overflow-hidden">
        <button onclick="window.closeQrZoom()" class="absolute top-3 right-3 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full w-10 h-10 flex items-center justify-center text-xl transition-colors">
          <i class="fas fa-times"></i>
        </button>
        <div class="flex flex-col items-center">
          <div class="relative overflow-auto flex items-center justify-center" style="max-height:80vh; max-width:90vw;">
            <img id="qrZoomImage" src="${QR_IMAGE_PATH}" alt="QR Code" class="object-contain" style="max-width:90vw; max-height:75vh;" />
          </div>
          <div class="mt-3 flex items-center gap-4">
            <button onclick="window.downloadQrImage()" class="btn-primary text-sm py-2 px-4">
              <i class="fas fa-download"></i> Download
            </button>
            <button onclick="window.closeQrZoom()" class="btn-outline text-sm py-2 px-4">
              <i class="fas fa-times"></i> Close
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

export function renderPaymentModal() {
  renderQrZoomModal();

  const existing = document.getElementById('paymentModal');
  if (existing) {
    if (existing.dataset.version === 'v3') return;
    existing.remove();
    const oldForm = document.getElementById('paymentForm');
    if (oldForm) oldForm.dataset.bound = '';
  }

  const modalHTML = `
    <div id="paymentModal" data-version="v3" data-duemode="false" class="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[400] hidden p-4">
      <div class="bg-white rounded-2xl p-6 md:p-8 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-2xl font-bold text-gray-900">Complete Payment</h3>
          <button type="button" onclick="window.closePaymentModal()" class="text-gray-400 hover:text-gray-600 text-2xl transition-colors" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <div id="paymentOrderSummary" class="mb-4 p-3 bg-blue-50 rounded-xl text-sm text-gray-700">
          <div class="flex justify-between"><span>Order Total</span><strong id="paymentTotalUSD">$0.00</strong></div>
          <div id="paymentTotalBDTRow" class="flex justify-between mt-1 hidden"><span>Total in BDT</span><strong id="paymentTotalBDT" class="text-green-700">৳0</strong></div>
          <p id="paymentRateNote" class="text-xs text-gray-400 mt-1 hidden"></p>
        </div>

        <form id="paymentForm" class="space-y-4">
          <input type="hidden" id="paymentOrderId" />
          
          <!-- Payment Type Option: Full vs Pay later (500 TK) -->
          <div id="paymentTypeGroup">
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Payment Type *</label>
            <div class="grid grid-cols-2 gap-3">
              <label class="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                <input type="radio" name="paymentType" value="full" checked class="text-blue-600 focus:ring-blue-500" />
                <span class="text-sm font-medium text-gray-800">Full Payment</span>
              </label>
              <label class="flex items-center gap-2 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                <input type="radio" name="paymentType" value="advance" class="text-blue-600 focus:ring-blue-500" />
                <span class="text-sm font-medium text-gray-800">Pay Later</span>
              </label>
            </div>
          </div>

          <div>
            <label class="block text-sm font-semibold text-gray-700 mb-1.5">Payment Method *</label>
            <select id="paymentMethodSelect" required class="form-input">
              <option value="">Select method</option>
              <option value="bKash">bKash</option>
              <option value="Nagad">Nagad</option>
              <option value="USDT">USDT (BEP20)</option>
            </select>
          </div>

          <div id="paymentMethodDetails" class="hidden space-y-4">
            <div id="paymentAddressBox" class="text-sm bg-gray-50 p-4 rounded-xl border border-gray-100"></div>
            <div id="paymentHowToBox" class="text-sm bg-amber-50 p-4 rounded-xl border border-amber-100"></div>

            <div id="paymentFieldsBox" class="space-y-4">
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1.5" id="paymentSenderLabel">Sender Number *</label>
                <input type="text" id="paymentSenderNumber" placeholder="Number you paid from" class="form-input" />
                <p class="text-xs text-gray-400 mt-1" id="paymentSenderHint">Your bKash/Nagad personal number</p>
              </div>
              <div>
                <label class="block text-sm font-semibold text-gray-700 mb-1.5">Transaction ID *</label>
                <input type="text" id="transactionId" placeholder="Enter transaction ID from the app" class="form-input" />
              </div>
              <button type="submit" id="paymentSubmitBtn" class="btn-primary w-full justify-center">
                <i class="fas fa-check"></i> Confirm Payment
              </button>
            </div>
          </div>

          <div id="paymentError" class="text-red-500 text-sm hidden text-center p-3 bg-red-50 rounded-xl border border-red-200"></div>
        </form>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);

  if (!document.getElementById('paymentModalStyle')) {
    const style = document.createElement('style');
    style.id = 'paymentModalStyle';
    style.textContent = `
      @keyframes scaleIn {
        from { opacity: 0; transform: scale(0.95); }
        to { opacity: 1; transform: scale(1); }
      }
      .animate-scaleIn { animation: scaleIn 0.25s ease forwards; }
    `;
    document.head.appendChild(style);
  }

  const methodSelect = document.getElementById('paymentMethodSelect');
  if (methodSelect && !methodSelect.dataset.bound) {
    methodSelect.dataset.bound = '1';
    methodSelect.addEventListener('change', () => window.updatePaymentMethodUI());
  }

  // Radio button change listener to recalculate amounts
  document.querySelectorAll('input[name="paymentType"]').forEach(radio => {
    if (!radio.dataset.bound) {
      radio.dataset.bound = '1';
      radio.addEventListener('change', () => window.updatePaymentMethodUI());
    }
  });

  const paymentForm = document.getElementById('paymentForm');
  if (paymentForm && !paymentForm.dataset.bound) {
    paymentForm.dataset.bound = '1';
    paymentForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const isDueMode = document.getElementById('paymentModal').dataset.duemode === 'true';
      const dueData = window._duePaymentData;
      const orderId = document.getElementById('paymentOrderId').value;

      // If due mode, handle due payment update
      if (isDueMode && dueData) {
        const method = document.getElementById('paymentMethodSelect').value;
        const txnId = document.getElementById('transactionId').value.trim();
        const senderNumber = document.getElementById('paymentSenderNumber').value.trim();
        const errorDiv = document.getElementById('paymentError');
        errorDiv.classList.add('hidden');
        document.querySelectorAll('#paymentForm .form-input').forEach(el => el.classList.remove('error'));

        if (!method) {
          errorDiv.textContent = '⚠️ Please select a payment method.';
          errorDiv.classList.remove('hidden');
          methodSelect.classList.add('error');
          return;
        }

        if (method === 'USDT') {
          if (!senderNumber || senderNumber.length < 10) {
            errorDiv.textContent = '⚠️ Please enter your valid BEP20 sender address.';
            errorDiv.classList.remove('hidden');
            document.getElementById('paymentSenderNumber').classList.add('error');
            return;
          }
          if (!txnId || txnId.length < 5) {
            errorDiv.textContent = '⚠️ Please enter a valid USDT transaction ID.';
            errorDiv.classList.remove('hidden');
            document.getElementById('transactionId').classList.add('error');
            return;
          }
        } else {
          if (!senderNumber) {
            errorDiv.textContent = '⚠️ Please enter the number you paid from.';
            errorDiv.classList.remove('hidden');
            document.getElementById('paymentSenderNumber').classList.add('error');
            return;
          }
          if (!txnId) {
            errorDiv.textContent = '⚠️ Please enter transaction ID.';
            errorDiv.classList.remove('hidden');
            document.getElementById('transactionId').classList.add('error');
            return;
          }
        }

        if (!auth.currentUser) {
          errorDiv.textContent = '⚠️ You are not logged in.';
          errorDiv.classList.remove('hidden');
          return;
        }

        const btn = document.getElementById('paymentSubmitBtn');
        setLoading(btn, true, 'Processing...');

        try {
          const orderRef = doc(db, 'orders', dueData.orderId);
          const orderSnap = await getDoc(orderRef);
          if (!orderSnap.exists()) {
            throw new Error('Order not found.');
          }

          const currentOrder = orderSnap.data();
          const newPaidBDT = (currentOrder.amountBDT || 0) + dueData.dueBDT;
          const newPaidUSD = (currentOrder.amountUSD || 0) + dueData.dueUSD;
          const newDueBDT = Math.max(0, (currentOrder.dueAmountBDT || 0) - dueData.dueBDT);
          const newDueUSD = Math.max(0, (currentOrder.dueAmountUSD || 0) - dueData.dueUSD);

          await updateDoc(orderRef, {
            amountBDT: newPaidBDT,
            amountUSD: newPaidUSD,
            dueAmountBDT: newDueBDT,
            dueAmountUSD: newDueUSD,
            transactionId: txnId,
            senderNumber: senderNumber,
            paymentMethod: method,
            updatedAt: serverTimestamp(),
            ...(newDueBDT === 0 ? { duePaidAt: serverTimestamp() } : {})
          });

          window.showToast('✅ Due payment successful! Order updated.', 'success');
          window.closePaymentModal();
          window._duePaymentData = null;
          // Refresh the page to update order list
          setTimeout(() => window.location.reload(), 1500);

        } catch (err) {
          console.error('Due payment error:', err);
          errorDiv.textContent = '⚠️ ' + err.message;
          errorDiv.classList.remove('hidden');
          window.showToast('⚠️ ' + err.message, 'error');
        } finally {
          setLoading(btn, false);
        }
        return;
      }

      // Normal checkout (full or advance) - existing logic
      const pending = window._pendingCheckoutData;
      if (!pending) {
        showToast('Checkout data missing. Please try again.', 'error');
        return;
      }

      const method = document.getElementById('paymentMethodSelect').value;
      const paymentType = document.querySelector('input[name="paymentType"]:checked').value;
      const txnId = document.getElementById('transactionId').value.trim();
      const senderNumber = document.getElementById('paymentSenderNumber').value.trim();
      const errorDiv = document.getElementById('paymentError');
      errorDiv.classList.add('hidden');
      document.querySelectorAll('#paymentForm .form-input').forEach(el => el.classList.remove('error'));

      if (!method) {
        errorDiv.textContent = '⚠️ Please select a payment method.';
        errorDiv.classList.remove('hidden');
        methodSelect.classList.add('error');
        return;
      }

      if (method === 'USDT') {
        if (!senderNumber || senderNumber.length < 10) {
          errorDiv.textContent = '⚠️ Please enter your valid BEP20 sender address.';
          errorDiv.classList.remove('hidden');
          document.getElementById('paymentSenderNumber').classList.add('error');
          return;
        }
        if (!txnId || txnId.length < 5) {
          errorDiv.textContent = '⚠️ Please enter a valid USDT transaction ID.';
          errorDiv.classList.remove('hidden');
          document.getElementById('transactionId').classList.add('error');
          return;
        }
      } else {
        if (!senderNumber) {
          errorDiv.textContent = '⚠️ Please enter the number you paid from.';
          errorDiv.classList.remove('hidden');
          document.getElementById('paymentSenderNumber').classList.add('error');
          return;
        }
        if (!txnId) {
          errorDiv.textContent = '⚠️ Please enter transaction ID.';
          errorDiv.classList.remove('hidden');
          document.getElementById('transactionId').classList.add('error');
          return;
        }
      }

      if (!auth.currentUser) {
        errorDiv.textContent = '⚠️ You are not logged in.';
        errorDiv.classList.remove('hidden');
        return;
      }

      const rate = Number(_paymentSettings.usdRate) > 0 ? Number(_paymentSettings.usdRate) : 125;
      const totalUSD = Number(_paymentOrderTotalUSD) || 0;
      const totalBDT = Math.round(totalUSD * rate);

      // Calculations for Advance vs Full
      let paidAmountBDT = totalBDT;
      let dueAmountBDT = 0;
      let paidAmountUSD = totalUSD;
      let dueAmountUSD = 0;

      if (paymentType === 'advance') {
        paidAmountBDT = 500;
        dueAmountBDT = Math.max(0, totalBDT - 500);
        paidAmountUSD = Number((500 / rate).toFixed(2));
        dueAmountUSD = Math.max(0, Number((totalUSD - paidAmountUSD).toFixed(2)));
      }

      const btn = document.getElementById('paymentSubmitBtn');
      setLoading(btn, true, 'Confirm Payment');

      try {
        const orderData = {
          userId: pending.user.uid,
          userEmail: pending.user.email,
          items: pending.cart.map(item => ({
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: item.quantity || 1,
            imageUrl: item.imageUrl || ''
          })),
          total: pending.total,
          status: 'pending',
          paymentMethod: method,
          paymentType: paymentType, // 'full' or 'advance'
          transactionId: txnId,
          senderNumber: senderNumber,
          amountUSD: paidAmountUSD,
          amountBDT: paidAmountBDT,
          dueAmountUSD: dueAmountUSD,
          dueAmountBDT: dueAmountBDT,
          usdRate: rate,
          createdAt: serverTimestamp()
        };

        if (method === 'USDT') {
          orderData.senderAddress = senderNumber;
        }

        const docRef = await addDoc(collection(db, 'orders'), orderData);
        const orderId = docRef.id;

        showToast('✅ Payment confirmed! Order placed. Admin will verify soon.', 'success');
        window.closePaymentModal();
        
        // --- CLEAR CART (LOCAL + FIRESTORE) ---
        localStorage.removeItem('cart');
        updateCartPopupUI();
        updateCartBadge();

        // 🔥 CRITICAL FIX: Clear Firestore cart to prevent sync from restoring it
        await updateCartInFirestore(pending.user.uid, []);

        if (typeof window.toggleCart === 'function') window.toggleCart();

        window._pendingCheckoutData = null;
        setTimeout(() => {
          window.location.href = 'my-orders.html';
        }, 1500);

      } catch (err) {
        console.error('Payment/Order error:', err);
        errorDiv.textContent = '⚠️ ' + err.message;
        errorDiv.classList.remove('hidden');
        showToast('⚠️ ' + err.message, 'error');
      } finally {
        setLoading(btn, false);
      }
    });
  }
}

export function openPaymentModal(data) {
  if (!document.getElementById('paymentModal')) {
    showToast('Payment system not ready. Please refresh.', 'error');
    return;
  }

  window._pendingCheckoutData = data;
  _paymentSettings = data.settings || {};
  _paymentOrderTotalUSD = Number(data.total) || 0;

  if (!(_paymentSettings.usdRate > 0)) _paymentSettings.usdRate = 125;
  if (!_paymentSettings.usdt) {
    _paymentSettings.usdt = DEFAULT_USDT_ADDRESS;
  }

  // Reset due mode
  document.getElementById('paymentModal').dataset.duemode = 'false';
  // Enable advance radio
  document.querySelectorAll('input[name="paymentType"]').forEach(el => {
    if (el.value === 'advance') {
      el.disabled = false;
      el.closest('label').style.display = '';
    }
  });

  // Default radio to full payment
  const fullRadio = document.querySelector('input[name="paymentType"][value="full"]');
  if (fullRadio) fullRadio.checked = true;

  document.getElementById('paymentOrderId').value = '';
  document.getElementById('paymentTotalUSD').textContent = '$' + _paymentOrderTotalUSD.toFixed(2);
  document.getElementById('paymentTotalBDTRow').classList.add('hidden');
  document.getElementById('paymentRateNote').classList.add('hidden');
  document.getElementById('paymentMethodDetails').classList.add('hidden');
  document.getElementById('paymentError').classList.add('hidden');

  const methodSelect = document.getElementById('paymentMethodSelect');
  methodSelect.value = '';
  methodSelect.classList.remove('error');
  document.getElementById('paymentSenderNumber').value = '';
  document.getElementById('transactionId').value = '';

  document.getElementById('paymentModal').classList.remove('hidden');
}
window.openPaymentModal = openPaymentModal;

// ================================================================
// ✅ DUE PAYMENT MODAL (Pay remaining due)
// ================================================================
window.openDuePaymentModal = function(orderId, dueUSD, dueBDT, settings, orderData) {
  if (!document.getElementById('paymentModal')) {
    showToast('Payment system not ready. Please refresh.', 'error');
    return;
  }

  // Store due info globally
  window._duePaymentData = {
    orderId: orderId,
    dueUSD: dueUSD,
    dueBDT: dueBDT,
    settings: settings,
    orderData: orderData
  };

  // Set total to due amount
  _paymentOrderTotalUSD = dueUSD;
  _paymentSettings = settings || {};
  if (!_paymentSettings.usdRate || _paymentSettings.usdRate <= 0) _paymentSettings.usdRate = 125;

  // Override payment type radio to force "full" (since it's due payment)
  const fullRadio = document.querySelector('input[name="paymentType"][value="full"]');
  if (fullRadio) fullRadio.checked = true;
  const advanceRadio = document.querySelector('input[name="paymentType"][value="advance"]');
  if (advanceRadio) {
    advanceRadio.disabled = true; // disable pay later option for due
    advanceRadio.closest('label').style.display = 'none';
  }

  // Set due mode flag
  document.getElementById('paymentModal').dataset.duemode = 'true';

  // Update UI
  document.getElementById('paymentOrderId').value = orderId;
  document.getElementById('paymentTotalUSD').textContent = '$' + dueUSD.toFixed(2);
  document.getElementById('paymentTotalBDTRow').classList.remove('hidden');
  document.getElementById('paymentTotalBDT').textContent = '৳' + dueBDT.toFixed(0);
  document.getElementById('paymentRateNote').classList.remove('hidden');
  document.getElementById('paymentRateNote').textContent = `Due payment: $${dueUSD.toFixed(2)} USD = ৳${dueBDT.toFixed(0)} (Rate: 1 USD = ৳${_paymentSettings.usdRate})`;

  // Reset form fields
  document.getElementById('paymentMethodSelect').value = '';
  document.getElementById('paymentSenderNumber').value = '';
  document.getElementById('transactionId').value = '';
  document.getElementById('paymentError').classList.add('hidden');
  document.getElementById('paymentMethodDetails').classList.add('hidden');

  // Show modal
  document.getElementById('paymentModal').classList.remove('hidden');
};

window.closePaymentModal = function() {
  const el = document.getElementById('paymentModal');
  if (el) {
    el.classList.add('hidden');
    el.dataset.duemode = 'false';
  }
  // Re-enable advance radio if disabled
  document.querySelectorAll('input[name="paymentType"]').forEach(el => {
    if (el.value === 'advance') {
      el.disabled = false;
      el.closest('label').style.display = '';
    }
  });
  // Clear due data
  window._duePaymentData = null;
};

window.updatePaymentMethodUI = function() {
  const method = document.getElementById('paymentMethodSelect')?.value || '';
  const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value || 'full';
  const isDueMode = document.getElementById('paymentModal').dataset.duemode === 'true';
  const details = document.getElementById('paymentMethodDetails');
  const addressBox = document.getElementById('paymentAddressBox');
  const howToBox = document.getElementById('paymentHowToBox');
  const fieldsBox = document.getElementById('paymentFieldsBox');
  const bdtRow = document.getElementById('paymentTotalBDTRow');
  const rateNote = document.getElementById('paymentRateNote');
  const errorDiv = document.getElementById('paymentError');
  if (errorDiv) errorDiv.classList.add('hidden');

  if (!method) {
    details.classList.add('hidden');
    bdtRow.classList.add('hidden');
    rateNote.classList.add('hidden');
    return;
  }

  details.classList.remove('hidden');
  const rate = Number(_paymentSettings.usdRate) > 0 ? Number(_paymentSettings.usdRate) : 125;
  const totalUSD = Number(_paymentOrderTotalUSD) || 0;
  const totalBDT = Math.round(totalUSD * rate);

  let payableBDT = totalBDT;
  let payableUSD = totalUSD;

  if (paymentType === 'advance' && !isDueMode) {
    payableBDT = 500;
    payableUSD = Number((500 / rate).toFixed(2));
  }

  if (method === 'bKash' || method === 'Nagad') {
    bdtRow.classList.remove('hidden');
    let bdtText;
    if (isDueMode) {
      bdtText = '৳' + totalBDT.toLocaleString('en-BD') + ' (Due)';
    } else if (paymentType === 'advance') {
      bdtText = '৳500 (Advance)';
    } else {
      bdtText = '৳' + totalBDT.toLocaleString('en-BD');
    }
    document.getElementById('paymentTotalBDT').textContent = bdtText;
    
    rateNote.classList.remove('hidden');
    if (isDueMode) {
      rateNote.textContent = `Due Payment: Send exactly ৳${totalBDT.toLocaleString('en-BD')}`;
    } else if (paymentType === 'advance') {
      const dueBDT = Math.max(0, totalBDT - 500);
      rateNote.textContent = `Advance Payment: ৳500 · Remaining Due: ৳${dueBDT.toLocaleString('en-BD')} (Pay after work)`;
    } else {
      rateNote.textContent = `Rate: 1 USD = ৳${rate} · Send exactly ৳${totalBDT.toLocaleString('en-BD')}`;
    }

    const number = method === 'bKash' ? (_paymentSettings.bkash || '') : (_paymentSettings.nagad || '');
    const color = method === 'bKash' ? 'text-pink-600' : 'text-orange-600';
    addressBox.innerHTML = number
      ? `<p class="font-semibold text-gray-800 mb-1">Send money to this ${method} number:</p>
         <p class="text-xl font-bold ${color} tracking-wide select-all">${number}</p>
         <p class="text-xs text-gray-400 mt-1">Amount to send: <strong>৳${payableBDT.toLocaleString('en-BD')}</strong></p>`
      : `<p class="text-red-500">${method} number not set. Contact admin.</p>`;

    const appName = method === 'bKash' ? 'bKash' : 'Nagad';
    const dialCode = method === 'bKash' ? '*247#' : '*167#';
    const dialSendOption = method === 'bKash' ? '1' : '2';
    const user = auth.currentUser;
    const username = (user?.displayName || (user?.email ? user.email.split('@')[0] : '') || 'your username');
    const numDisplay = number || '—';
    const amountDisplay = '৳' + payableBDT.toLocaleString('en-BD');

    howToBox.innerHTML = `
      <p class="font-semibold text-gray-800 mb-2"><i class="fas fa-mobile-alt mr-1"></i> How to pay — ${appName} App</p>
      <ol class="list-decimal list-inside space-y-1 text-gray-600 text-sm mb-4">
        <li>Open the <strong>${appName}</strong> app and log in</li>
        <li>Go to <strong>Send Money</strong></li>
        <li>Enter number: <strong class="select-all">${numDisplay}</strong></li>
        <li>Enter amount: <strong>${amountDisplay}</strong></li>
        <li>In <strong>Reference</strong>, enter your username: <strong class="select-all">${username}</strong></li>
        <li>Enter your PIN and <strong>Confirm</strong></li>
        <li>Copy the <strong>Transaction ID</strong> and paste it below</li>
      </ol>
      <p class="font-semibold text-gray-800 mb-2"><i class="fas fa-phone-alt mr-1"></i> How to pay — Dial (USSD)</p>
      <ol class="list-decimal list-inside space-y-1 text-gray-600 text-sm">
        <li>Dial <strong class="select-all">${dialCode}</strong></li>
        <li>Select option <strong>${dialSendOption}. Send Money</strong></li>
        <li>Enter number: <strong class="select-all">${numDisplay}</strong></li>
        <li>Enter amount: <strong>${amountDisplay}</strong></li>
        <li>Enter username in reference: <strong class="select-all">${username}</strong></li>
        <li>Enter PIN and confirm</li>
        <li>Copy the <strong>Transaction ID</strong> and paste it below</li>
      </ol>`;

    fieldsBox.classList.remove('hidden');
    document.getElementById('paymentSenderLabel').textContent = `Your ${method} Number *`;
    document.getElementById('paymentSenderNumber').placeholder = `Number you sent money from`;
    document.getElementById('paymentSenderHint').textContent = `Your personal ${method} number (sender)`;
    document.getElementById('paymentSubmitBtn').disabled = !number;

  } else if (method === 'USDT') {
    bdtRow.classList.add('hidden');
    rateNote.classList.remove('hidden');
    if (isDueMode) {
      rateNote.textContent = `Due payment: $${totalUSD.toFixed(2)} USD (send exactly this amount in USDT on BEP20)`;
    } else if (paymentType === 'advance') {
      const dueUSD = Math.max(0, Number((totalUSD - payableUSD).toFixed(2)));
      rateNote.textContent = `Advance Payment: $${payableUSD.toFixed(2)} USD · Remaining Due: $${dueUSD.toFixed(2)} USD`;
    } else {
      rateNote.textContent = `Order total: $${totalUSD.toFixed(2)} USD (send exactly this amount in USDT on BEP20)`;
    }

    const usdtAddress = _paymentSettings.usdt || DEFAULT_USDT_ADDRESS;

    addressBox.innerHTML = `
      <p class="font-semibold text-gray-800 mb-2"><i class="fab fa-bitcoin text-yellow-500 mr-1"></i> USDT (BEP20)</p>
      <p class="text-sm text-gray-500">Network: <strong>BSC (BEP20)</strong></p>
      <div class="flex flex-col items-center my-2">
        <div class="relative w-full max-w-[300px] mx-auto cursor-pointer" onclick="window.openQrZoom('${QR_IMAGE_PATH}')" title="Click to zoom">
          <img src="${QR_IMAGE_PATH}" 
               alt="USDT Deposit QR Code" 
               class="w-[95%] mx-auto rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow"
               onerror="this.style.display='none'; document.getElementById('qrFallback').style.display='block';" />
          <div id="qrFallback" style="display:none;" class="text-amber-600 text-sm mt-2 text-center">
            <i class="fas fa-exclamation-triangle"></i> QR code not available. Please copy address below.
          </div>
          <div class="text-center mt-1 text-xs text-blue-500">
            <i class="fas fa-search-plus"></i> Click to zoom
          </div>
        </div>
      </div>
      <div class="bg-gray-100 p-3 rounded-xl flex items-center justify-between gap-2 break-all">
        <code class="text-xs font-mono text-gray-800 select-all">${usdtAddress}</code>
        <button onclick="navigator.clipboard.writeText('${usdtAddress}').then(()=>showToast('✅ Address copied!','success'))" 
                class="text-blue-600 hover:text-blue-800 text-sm flex-shrink-0" title="Copy address">
          <i class="fas fa-copy"></i> Copy
        </button>
      </div>
      <p class="text-xs text-gray-400 mt-2">Send exactly <strong>$${payableUSD.toFixed(2)} USDT</strong> to this address.</p>
      <p class="text-xs text-red-400 mt-1"><i class="fas fa-exclamation-triangle"></i> Use BEP20 network only, otherwise funds may be lost.</p>
    `;

    howToBox.innerHTML = `
      <p class="font-semibold text-gray-800 mb-2"><i class="fas fa-mobile-alt mr-1"></i> How to send USDT (BEP20) from Binance</p>
      <ol class="list-decimal list-inside space-y-1 text-gray-600 text-sm mb-2">
        <li>Open <strong>Binance App</strong> → Go to <strong>Wallet</strong> → <strong>Withdraw</strong></li>
        <li>Select coin: <strong>USDT</strong></li>
        <li>Select network: <strong>BSC (BEP20)</strong></li>
        <li>Paste the address: <strong class="select-all">${usdtAddress}</strong></li>
        <li>Enter amount: <strong>$${payableUSD.toFixed(2)} USDT</strong></li>
        <li>Double‑check the network and address, then submit</li>
        <li>Copy the <strong>Transaction ID (TXID)</strong> and your <strong>Sender Address</strong> below</li>
      </ol>
      <p class="text-xs text-blue-600"><i class="fas fa-info-circle"></i> Need help? <a href="https://www.binance.com/en/support/faq/how-to-withdraw-cryptocurrency-from-binance-360033577672" target="_blank" class="underline">Binance withdrawal guide</a></p>
    `;

    fieldsBox.classList.remove('hidden');
    document.getElementById('paymentSenderLabel').textContent = 'Your BEP20 Sender Address *';
    document.getElementById('paymentSenderNumber').placeholder = '0x... your wallet address';
    document.getElementById('paymentSenderHint').textContent = 'The BEP20 address you sent from (starts with 0x)';
    document.getElementById('paymentSubmitBtn').disabled = false;
  }
};

window.checkout = async function() {
  const cart = JSON.parse(localStorage.getItem('cart')) || [];
  if (cart.length === 0) {
    window.showToast('🛒 Your cart is empty', 'warning');
    return;
  }

  const user = auth.currentUser;
  if (!user) {
    window.showToast('⚠️ Please sign in to checkout', 'error');
    if (typeof window.openAuthModal === 'function') window.openAuthModal('signin');
    return;
  }

  const checkoutBtn = document.querySelector('.cart-checkout-btn');
  if (checkoutBtn) setLoading(checkoutBtn, true, 'Processing...');

  try {
    const settingsSnap = await getDoc(doc(db, 'settings', 'payment'));
    const settings = settingsSnap.exists() ? settingsSnap.data() : {};
    if (!settings.usdRate || Number(settings.usdRate) <= 0) settings.usdRate = 125;
    if (!settings.usdt) {
      settings.usdt = DEFAULT_USDT_ADDRESS;
    }
    if (!settings.bkash && !settings.nagad && !settings.usdt) {
      window.showToast('⚠️ No payment methods configured. Contact admin.', 'error');
      if (checkoutBtn) setLoading(checkoutBtn, false);
      return;
    }

    const total = cart.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
    
    const data = {
      cart: cart,
      total: total,
      settings: settings,
      user: user
    };

    openPaymentModal(data);
    if (checkoutBtn) setLoading(checkoutBtn, false);
  } catch (err) {
    window.showToast('⚠️ ' + err.message, 'error');
    if (checkoutBtn) setLoading(checkoutBtn, false);
  }
};

// ================================================================
// ✅ CLOUDINARY UPLOAD
// ================================================================
const CLOUDINARY_CLOUD_NAME = 'zmoyykj7';
const CLOUDINARY_UPLOAD_PRESET = 'codecurebd';

export async function uploadImage(file) {
  if (!file) throw new Error('No file selected.');
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('Image must be less than 10MB.');
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    );
    const data = await response.json();

    if (data.error) {
      throw new Error(data.error.message || 'Upload failed.');
    }

    return data.secure_url;
  } catch (err) {
    console.error('❌ Cloudinary Upload Error:', err);
    throw err;
  }
}

export async function syncCart(userId) {
  if (!userId) return;
  const cartRef = doc(db, 'carts', userId);
  try {
    const localCart = JSON.parse(localStorage.getItem('cart')) || [];
    const docSnap = await getDoc(cartRef);
    let serverCart = [];
    if (docSnap.exists()) {
      serverCart = docSnap.data().items || [];
    }
    if (localCart.length > 0) {
      await setDoc(cartRef, { items: localCart, updatedAt: new Date().toISOString() });
    } else if (serverCart.length > 0) {
      localStorage.setItem('cart', JSON.stringify(serverCart));
      updateCartBadge();
      updateCartPopupUI();
    }
  } catch (err) {
    console.error('Cart sync error:', err);
  }
}

export async function updateCartInFirestore(userId, cart) {
  if (!userId) return;
  const cartRef = doc(db, 'carts', userId);
  try {
    await setDoc(cartRef, { items: cart, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error('Firestore cart update error:', err);
  }
}

export function updateNavbarAuth(user, displayName, role = null) {
  const authBtns = document.getElementById('auth-buttons');
  const profileSection = document.getElementById('profile-section');
  const loadingEl = document.getElementById('auth-loading');
  const avatar = document.getElementById('profileAvatar');
  const adminLink = document.getElementById('adminPanelLink');
  const mobileAdminLink = document.getElementById('mobileAdminPanelLink');
  const authRequiredActions = document.getElementById('authRequiredActions');

  if (loadingEl) loadingEl.style.display = 'none';

  if (user) {
    if (authBtns) authBtns.classList.add('hidden');
    if (profileSection) profileSection.classList.remove('hidden');
    if (avatar) avatar.textContent = (displayName || user.email).charAt(0).toUpperCase();
    
    if (authRequiredActions) authRequiredActions.style.display = 'flex';

    const isAdmin = (role === 'admin');
    if (adminLink) {
      adminLink.style.display = isAdmin ? '' : 'none';
      adminLink.classList.toggle('hidden', !isAdmin);
    }
    if (mobileAdminLink) {
      mobileAdminLink.style.display = isAdmin ? '' : 'none';
      mobileAdminLink.classList.toggle('hidden', !isAdmin);
    }

    if (!isAdmin) {
      startAdminMessageListener(user);
    } else {
      if (adminMessageUnsubscribe) {
        adminMessageUnsubscribe();
        adminMessageUnsubscribe = null;
      }
      updateNotificationBadge(0);
      updateNotificationList([]);
    }

  } else {
    if (authBtns) authBtns.classList.remove('hidden');
    if (profileSection) profileSection.classList.add('hidden');
    if (adminLink) { adminLink.style.display = 'none'; adminLink.classList.add('hidden'); }
    if (mobileAdminLink) { mobileAdminLink.style.display = 'none'; mobileAdminLink.classList.add('hidden'); }
    if (adminMessageUnsubscribe) {
      adminMessageUnsubscribe();
      adminMessageUnsubscribe = null;
    }
    updateNotificationBadge(0);
    updateNotificationList([]);

    if (authRequiredActions) authRequiredActions.style.display = 'none';
  }
}

document.addEventListener('click', (e) => {
  const searchDropdown = document.getElementById('searchDropdown');
  const searchBtn = document.querySelector('[onclick="window.toggleSearchDropdown()"]');
  if (searchDropdown && searchBtn && !searchDropdown.classList.contains('hidden')) {
    if (!searchBtn.contains(e.target) && !searchDropdown.contains(e.target)) {
      searchDropdown.classList.add('hidden');
      document.body.classList.remove('dropdown-open');
      const input = document.getElementById('searchInput');
      if (input) input.value = '';
      const results = document.getElementById('searchResults');
      if (results) results.innerHTML = '';
      searchDropdownOpen = false;
    }
  }

  const notifDropdown = document.getElementById('notificationDropdown');
  const notifBtn = document.querySelector('[onclick="window.toggleNotifications()"]');
  if (notifBtn && notifDropdown && !notifDropdown.classList.contains('hidden')) {
    if (!notifBtn.contains(e.target) && !notifDropdown.contains(e.target)) {
      notifDropdown.classList.add('hidden');
      document.body.classList.remove('dropdown-open');
      displayMessages = [];
    }
  }

  const cartPopup = document.getElementById('cartPopup');
  const cartBtn = document.getElementById('cartBtn');
  if (cartBtn && cartPopup && !cartPopup.classList.contains('hidden')) {
    if (!cartBtn.contains(e.target) && !cartPopup.contains(e.target)) {
      cartPopup.classList.add('hidden');
      document.body.classList.remove('dropdown-open');
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const searchDropdown = document.getElementById('searchDropdown');
    if (searchDropdown && !searchDropdown.classList.contains('hidden')) {
      searchDropdown.classList.add('hidden');
      document.body.classList.remove('dropdown-open');
      const input = document.getElementById('searchInput');
      if (input) input.value = '';
      const results = document.getElementById('searchResults');
      if (results) results.innerHTML = '';
      searchDropdownOpen = false;
    }
    const notifDropdown = document.getElementById('notificationDropdown');
    if (notifDropdown && !notifDropdown.classList.contains('hidden')) {
      notifDropdown.classList.add('hidden');
      document.body.classList.remove('dropdown-open');
      displayMessages = [];
    }
    const cartPopup = document.getElementById('cartPopup');
    if (cartPopup && !cartPopup.classList.contains('hidden')) {
      cartPopup.classList.add('hidden');
      document.body.classList.remove('dropdown-open');
    }
    if (document.getElementById('qrZoomModal') && !document.getElementById('qrZoomModal').classList.contains('hidden')) {
      window.closeQrZoom();
    }
    // Close payment modal on escape
    const paymentModal = document.getElementById('paymentModal');
    if (paymentModal && !paymentModal.classList.contains('hidden')) {
      window.closePaymentModal();
    }
  }
});

// ================================================================
// ✅ COMMON AUTH MODAL SYSTEM (Advanced - Shared across all pages)
// ================================================================

let currentAuthMode = 'signin'; // signin | signup | forgot

export function renderAuthModal() {
  if (document.getElementById('authModal')) return;

  const modalHTML = `
    <div id="authModal" class="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[600] hidden p-4">
      <div class="bg-white rounded-2xl p-6 md:p-8 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto" style="animation: scaleIn 0.3s ease forwards;">
        
        <div class="flex justify-between items-center mb-5">
          <h3 id="authModalTitle" class="text-2xl font-bold text-gray-900">Sign In</h3>
          <button onclick="window.closeAuthModal()" class="text-gray-400 hover:text-gray-600 text-xl transition-colors" aria-label="Close">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <form id="authForm" class="space-y-4">
          <div id="nameField" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Full Name *</label>
            <input type="text" id="authName" class="form-input" placeholder="Your full name" autocomplete="name" />
          </div>

          <div id="phoneField" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
            <input type="tel" id="authPhone" class="form-input" placeholder="+880 1XXX-XXXXXX" autocomplete="tel" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
            <input type="email" id="authEmail" placeholder="your@email.com" required class="form-input" autocomplete="email" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
            <div class="relative">
              <input type="password" id="authPassword" placeholder="••••••••" required class="form-input pr-12" autocomplete="current-password" />
              <button type="button" onclick="window.toggleAuthPassword('authPassword')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
                <i class="fas fa-eye" id="authPassIcon"></i>
              </button>
            </div>
          </div>

          <div id="confirmPasswordField" class="hidden">
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Confirm Password *</label>
            <div class="relative">
              <input type="password" id="authConfirmPassword" placeholder="••••••••" class="form-input pr-12" autocomplete="new-password" />
              <button type="button" onclick="window.toggleAuthPassword('authConfirmPassword')" class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-600">
                <i class="fas fa-eye"></i>
              </button>
            </div>
          </div>

          <div id="forgotPasswordLink" class="text-right">
            <a href="#" onclick="window.openForgotPassword(event)" class="text-sm text-blue-600 hover:underline font-medium">
              Forgot Password?
            </a>
          </div>

          <button type="submit" class="btn-primary w-full justify-center" id="authSubmitBtn">
            Sign In
          </button>
        </form>

        <form id="forgotPasswordForm" class="space-y-4 hidden">
          <p class="text-sm text-gray-500">
            Enter your email address and we will send you a link to reset your password.
          </p>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Email Address *</label>
            <input type="email" id="forgotEmail" placeholder="your@email.com" required class="form-input" />
          </div>
          <button type="submit" class="btn-primary w-full justify-center" id="forgotSubmitBtn">
            <i class="fas fa-paper-plane"></i> Send Reset Link
          </button>
          <button type="button" onclick="window.backToSignIn()" class="btn-outline w-full justify-center text-sm">
            ← Back to Sign In
          </button>
        </form>

        <div id="socialLoginSection" class="mt-5">
          <div class="relative my-4">
            <div class="absolute inset-0 flex items-center"><div class="w-full border-t border-gray-200"></div></div>
            <div class="relative flex justify-center text-sm">
              <span class="px-3 bg-white text-gray-400">or continue with</span>
            </div>
          </div>
          <button type="button" onclick="window.socialLogin('google')" class="btn-outline w-full justify-center">
            <i class="fab fa-google text-red-500"></i> Continue with Google
          </button>
        </div>

        <p id="authToggleSection" class="mt-5 text-sm text-gray-500 text-center">
          <span id="authToggleText">Don't have an account?</span>
          <a href="#" id="authToggleLink" class="text-blue-600 font-medium hover:underline">Sign Up</a>
        </p>

        <div id="authError" class="text-red-500 text-sm mt-3 hidden text-center p-2 bg-red-50 rounded-lg"></div>
        <div id="authSuccess" class="text-green-600 text-sm mt-3 hidden text-center p-2 bg-green-50 rounded-lg"></div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  initAuthModalEvents();
}

function updateAuthUI() {
  const title = document.getElementById('authModalTitle');
  const nameField = document.getElementById('nameField');
  const phoneField = document.getElementById('phoneField');
  const confirmField = document.getElementById('confirmPasswordField');
  const forgotLink = document.getElementById('forgotPasswordLink');
  const authForm = document.getElementById('authForm');
  const forgotForm = document.getElementById('forgotPasswordForm');
  const socialSection = document.getElementById('socialLoginSection');
  const toggleSection = document.getElementById('authToggleSection');
  const toggleText = document.getElementById('authToggleText');
  const toggleLink = document.getElementById('authToggleLink');
  const submitBtn = document.getElementById('authSubmitBtn');

  [nameField, phoneField, confirmField, forgotLink, authForm, forgotForm, socialSection, toggleSection].forEach(el => {
    if (el) el.classList.add('hidden');
  });

  if (currentAuthMode === 'signin') {
    title.textContent = 'Sign In';
    authForm.classList.remove('hidden');
    forgotLink.classList.remove('hidden');
    socialSection.classList.remove('hidden');
    toggleSection.classList.remove('hidden');
    toggleText.textContent = "Don't have an account?";
    toggleLink.textContent = 'Sign Up';
    submitBtn.innerHTML = 'Sign In';
  } else if (currentAuthMode === 'signup') {
    title.textContent = 'Create Account';
    authForm.classList.remove('hidden');
    nameField.classList.remove('hidden');
    phoneField.classList.remove('hidden');
    confirmField.classList.remove('hidden');
    socialSection.classList.remove('hidden');
    toggleSection.classList.remove('hidden');
    toggleText.textContent = 'Already have an account?';
    toggleLink.textContent = 'Sign In';
    submitBtn.innerHTML = 'Create Account';
  } else if (currentAuthMode === 'forgot') {
    title.textContent = 'Reset Password';
    forgotForm.classList.remove('hidden');
  }
}

function initAuthModalEvents() {
  document.getElementById('authToggleLink')?.addEventListener('click', (e) => {
    e.preventDefault();
    currentAuthMode = currentAuthMode === 'signin' ? 'signup' : 'signin';
    updateAuthUI();
    clearAuthMessages();
  });

  const authForm = document.getElementById('authForm');
  if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

  const forgotForm = document.getElementById('forgotPasswordForm');
  if (forgotForm) forgotForm.addEventListener('submit', handleForgotPassword);

  document.getElementById('authModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'authModal') window.closeAuthModal();
  });
}

function clearAuthMessages() {
  document.getElementById('authError')?.classList.add('hidden');
  document.getElementById('authSuccess')?.classList.add('hidden');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  clearAuthMessages();

  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName')?.value.trim() || '';
  const phone = document.getElementById('authPhone')?.value.trim() || '';
  const confirmPassword = document.getElementById('authConfirmPassword')?.value || '';
  const submitBtn = document.getElementById('authSubmitBtn');

  setLoading(submitBtn, true);

  try {
    if (currentAuthMode === 'signin') {
      await signInWithEmailAndPassword(auth, email, password);
      showToast('✅ Signed in successfully!', 'success');
      window.closeAuthModal();
    } else if (currentAuthMode === 'signup') {
      if (!name) throw new Error('Please enter your full name');
      if (password.length < 6) throw new Error('Password must be at least 6 characters');
      if (password !== confirmPassword) throw new Error('Passwords do not match');

      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCred.user;

      await setDoc(doc(db, 'users', user.uid), {
        email,
        displayName: name,
        phone: phone || '',
        role: 'user',
        createdAt: new Date().toISOString(),
        isActive: true,
        emailVerified: false
      });

      try { await sendEmailVerification(user); } catch (ve) { console.warn('Verification email failed:', ve); }

      showToast('✅ Account created successfully!', 'success');
      window.closeAuthModal();
    }
  } catch (error) {
    console.error(error);
    let msg = error.message;
    if (error.code === 'auth/email-already-in-use') msg = 'This email is already registered';
    else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') msg = 'Incorrect email or password';
    else if (error.code === 'auth/user-not-found') msg = 'No account found with this email';
    else if (error.code === 'auth/weak-password') msg = 'Password is too weak (min 6 characters)';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email address';
    else if (error.code === 'auth/too-many-requests') msg = 'Too many attempts. Try again later';

    const errorDiv = document.getElementById('authError');
    if (errorDiv) {
      errorDiv.textContent = '⚠️ ' + msg;
      errorDiv.classList.remove('hidden');
    }
  } finally {
    setLoading(submitBtn, false);
  }
}

async function handleForgotPassword(e) {
  e.preventDefault();
  clearAuthMessages();

  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) {
    const err = document.getElementById('authError');
    if (err) { err.textContent = 'Please enter your email'; err.classList.remove('hidden'); }
    return;
  }

  const btn = document.getElementById('forgotSubmitBtn');
  setLoading(btn, true, 'Sending...');

  try {
    await sendPasswordResetEmail(auth, email);
    const successDiv = document.getElementById('authSuccess');
    if (successDiv) {
      successDiv.innerHTML = '✅ Password reset link sent!<br>Check your inbox and spam folder.';
      successDiv.classList.remove('hidden');
    }
    showToast('✅ Reset link sent to your email', 'success');
  } catch (error) {
    let msg = error.message;
    if (error.code === 'auth/user-not-found') msg = 'No account found with this email';
    else if (error.code === 'auth/invalid-email') msg = 'Invalid email address';
    const err = document.getElementById('authError');
    if (err) { err.textContent = '⚠️ ' + msg; err.classList.remove('hidden'); }
  } finally {
    setLoading(btn, false);
  }
}

window.openAuthModal = function(mode = 'signin') {
  currentAuthMode = mode;
  renderAuthModal();
  updateAuthUI();
  clearAuthMessages();
  document.getElementById('authModal').classList.remove('hidden');
  setTimeout(() => {
    const firstInput = currentAuthMode === 'forgot'
      ? document.getElementById('forgotEmail')
      : document.getElementById('authEmail');
    firstInput?.focus();
  }, 100);
};

window.closeAuthModal = function() {
  document.getElementById('authModal')?.classList.add('hidden');
};

window.openForgotPassword = function(e) {
  if (e) e.preventDefault();
  currentAuthMode = 'forgot';
  updateAuthUI();
  clearAuthMessages();
};

window.backToSignIn = function() {
  currentAuthMode = 'signin';
  updateAuthUI();
  clearAuthMessages();
};

window.toggleAuthPassword = function(id) {
  const input = document.getElementById(id);
  if (!input) return;
  const icon = input.parentElement.querySelector('i');
  if (input.type === 'password') {
    input.type = 'text';
    if (icon) icon.className = 'fas fa-eye-slash';
  } else {
    input.type = 'password';
    if (icon) icon.className = 'fas fa-eye';
  }
};

window.socialLogin = async function(provider) {
  if (provider !== 'google') {
    showToast('Only Google sign-in is supported', 'warning');
    return;
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    if (!userDoc.exists()) {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email || '',
        displayName: user.displayName || (user.email ? user.email.split('@')[0] : 'User'),
        photoURL: user.photoURL || '',
        phone: '',
        role: 'user',
        createdAt: new Date().toISOString(),
        isActive: true,
        emailVerified: !!user.emailVerified,
      });
    }
    showToast('✅ Signed in with Google', 'success');
    window.closeAuthModal();
  } catch (error) {
    console.error('Google sign-in error:', error);
    let msg = error.message || 'Sign-in failed';
    if (error.code === 'auth/popup-closed-by-user') msg = 'Sign-in cancelled';
    else if (error.code === 'auth/popup-blocked') msg = 'Popup blocked. Please allow popups.';
    else if (error.code === 'auth/unauthorized-domain') msg = 'Domain not authorized in Firebase.';
    else if (error.code === 'auth/operation-not-allowed') msg = 'Google sign-in is not enabled.';
    showToast('⚠️ ' + msg, 'error');
  }
};

window.handleLogout = async function() {
  try {
    await signOut(auth);
    showToast('✅ Logged out', 'success');
    // Stay on page or redirect if needed - pages can override
    if (window.location.pathname.includes('my-') || window.location.pathname.includes('messages') || window.location.pathname.includes('settings')) {
      window.location.href = 'index.html';
    }
  } catch (err) {
    showToast('⚠️ ' + err.message, 'error');
  }
};

// Also close auth modal on Escape
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const authModal = document.getElementById('authModal');
    if (authModal && !authModal.classList.contains('hidden')) {
      window.closeAuthModal();
    }
  }
});

console.log('✅ components.js: Common Auth Modal system loaded (Sign In / Sign Up / Forgot Password / Google).');
