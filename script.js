/* ============================================================
   نووا گیم — Script
   Author: Aria Azizi
   v4.0 — Stable
   ============================================================ */

'use strict';

/* ═══════ ابزارها ═══════ */
const $  = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : v; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    json(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
};

function hashPass(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h = h & h; }
    return 'h_' + Math.abs(h).toString(36) + '_' + str.length;
}

function faNum(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
}

function stripHtml(html) {
    const d = document.createElement('div');
    d.innerHTML = html || '';
    return d.textContent || '';
}

function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'همین الان';
    if (d < 3600) return faNum(Math.floor(d / 60)) + ' دقیقه پیش';
    if (d < 86400) return faNum(Math.floor(d / 3600)) + ' ساعت پیش';
    if (d < 604800) return faNum(Math.floor(d / 86400)) + ' روز پیش';
    try { return new Date(ts).toLocaleDateString('fa-IR'); } catch (e) { return ''; }
}

function parseMentions(text) {
    return text.replace(/@([a-zA-Z][a-zA-Z0-9_]{2,19})/g, (m, u) =>
        '<span class="mention" data-username="' + u.toLowerCase() + '">@' + u + '</span>');
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        if (file.size > 800 * 1024) { reject('حجم فایل زیاده. حداکثر ۸۰۰ کیلوبایت.'); return; }
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject('خطا در خواندن فایل');
        reader.readAsDataURL(file);
    });
}

/* ═══════ Toast ═══════ */
let toastTimer;
function toast(msg, duration) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), duration || 2200);
}

/* ═══════ Storage ═══════ */
const DB = {
    K: {
        USERS: 'nova.users',
        POSTS: 'nova.posts',
        SESSION: 'nova.session',
        MESSAGES: 'nova.messages',
        NOTIFS: 'nova.notifs',
        GROUPS: 'nova.groups',
        ACTIVITY: 'nova.activity',
        BLOCKS: 'nova.blocks',
        PENDING: 'nova.pending'
    },
    getUsers() { return store.json(this.K.USERS, []); },
    setUsers(v) { store.set(this.K.USERS, JSON.stringify(v)); },
    getPosts() { return store.json(this.K.POSTS, []); },
    setPosts(v) { store.set(this.K.POSTS, JSON.stringify(v)); },
    getSession() { return store.json(this.K.SESSION, null); },
    setSession(v) { store.set(this.K.SESSION, JSON.stringify(v)); },
    clearSession() { store.del(this.K.SESSION); },
    getMessages() { return store.json(this.K.MESSAGES, []); },
    setMessages(v) { store.set(this.K.MESSAGES, JSON.stringify(v)); },
    getNotifs() { return store.json(this.K.NOTIFS, []); },
    setNotifs(v) { store.set(this.K.NOTIFS, JSON.stringify(v)); },
    getGroups() { return store.json(this.K.GROUPS, []); },
    setGroups(v) { store.set(this.K.GROUPS, JSON.stringify(v)); },
    getActivity() { return store.json(this.K.ACTIVITY, []); },
    setActivity(v) { store.set(this.K.ACTIVITY, JSON.stringify(v)); },
    getBlocks() { return store.json(this.K.BLOCKS, {}); },
    setBlocks(v) { store.set(this.K.BLOCKS, JSON.stringify(v)); },
    getPending() { return store.json(this.K.PENDING, []); },
    setPending(v) { store.set(this.K.PENDING, JSON.stringify(v)); }
};

/* ═══════ State ═══════ */
const State = {
    theme: store.get('nova.theme', 'light'),
    user: null,
    page: 'home',
    pageData: null,
    postFilter: 'all',
    timeFilter: 'day',
    groupFilter: 'all',
    adminTab: 'stats',
    editorTab: 'myposts',
    authorTab: 'myposts',
    editingPostId: null,
    cropMode: null,
    cropTarget: null,
    cropImg: null,
    cropZoom: 1,
    cropRotate: 0
};

/* ═══════ Theme ═══════ */
function applyTheme(theme) {
    let final = theme;
    if (theme === 'auto') {
        const h = new Date().getHours();
        final = (h >= 7 && h < 19) ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('light', final === 'light');
    document.documentElement.classList.toggle('dark', final === 'dark');
    State.theme = theme;
    store.set('nova.theme', theme);

    const icon = $('#themeIcon');
    if (icon) {
        if (theme === 'light') {
            icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
        } else if (theme === 'dark') {
            icon.innerHTML = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
        } else {
            icon.innerHTML = '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>';
        }
    }
}

function flipTheme() {
    const order = ['light', 'dark', 'auto'];
    const idx = order.indexOf(State.theme);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
    const labels = { light: 'حالت روز', dark: 'حالت شب', auto: 'حالت خودکار' };
    toast(labels[next]);
}

/* ═══════ User helpers ═══════ */
function getCurrentUser() {
    const session = DB.getSession();
    if (!session) return null;
    const users = DB.getUsers();
    return users.find(u => u.id === session.userId) || null;
}

function saveCurrentUser() {
    if (!State.user) return;
    const users = DB.getUsers();
    const idx = users.findIndex(u => u.id === State.user.id);
    if (idx > -1) { users[idx] = State.user; DB.setUsers(users); }
}

function getUserById(id) {
    return DB.getUsers().find(u => u.id === id) || null;
}

/* ═══════ Badges ═══════ */
function badgesHtml(user) {
    if (!user) return '';
    let html = '';
    if (user.role === 'admin') {
        html += '<svg class="badge-icon badge-crown-admin" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg>';
    }
    if (user.role === 'editor') {
        html += '<svg class="badge-icon badge-tick-editor" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.5L22 9.5l-5 4.5L18.5 22 12 18l-6.5 4L7 14 2 9.5l7-1z"/></svg>';
    }
    if (user.tick === 'blue') {
        html += '<svg class="badge-icon badge-tick-blue" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 14.5l-4-4L8 11l2.5 2.5L16 8l1.5 1.5-7 7z"/></svg>';
    }
    if (user.tick === 'gold') {
        html += '<svg class="badge-icon badge-tick-gold" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 14.5l-4-4L8 11l2.5 2.5L16 8l1.5 1.5-7 7z"/></svg>';
    }
    return html ? '<span class="name-badge">' + html + '</span>' : '';
}

/* ═══════ Blocks ═══════ */
function isBlocked(ownerId, targetId) {
    const b = DB.getBlocks();
    return !!(b[ownerId] && b[ownerId].indexOf(targetId) > -1);
}
function hasBlockedMe(meId, otherId) { return isBlocked(otherId, meId); }
function blockUser(targetId) {
    if (!State.user || targetId === State.user.id) return;
    const b = DB.getBlocks();
    b[State.user.id] = b[State.user.id] || [];
    if (b[State.user.id].indexOf(targetId) === -1) b[State.user.id].push(targetId);
    DB.setBlocks(b);
    toast('کاربر بلاک شد');
}
function unblockUser(targetId) {
    if (!State.user) return;
    const b = DB.getBlocks();
    if (b[State.user.id]) b[State.user.id] = b[State.user.id].filter(id => id !== targetId);
    DB.setBlocks(b);
    toast('رفع بلاک شد');
}

/* ═══════ Update UI ═══════ */
function updateAuthUI() {
    const u = State.user;
    const loginBtn = $('#loginBtn');
    const userBtn = $('#userBtn');
    const navAvatar = $('#navAvatar');
    const drawerUser = $('#drawerUser');
    const drawerAvatar = $('#drawerAvatar');
    const drawerName = $('#drawerName');
    const drawerUsername = $('#drawerUsername');
    const drawerLoginBtn = $('#drawerLoginBtn');
    const drawerNewPost = $('#drawerNewPost');
    const drawerAdminBtn = $('#drawerAdminBtn');
    const drawerEditorBtn = $('#drawerEditorBtn');
    const drawerAuthorBtn = $('#drawerAuthorBtn');
    const heroNewPost = $('#heroNewPost');
    const createGroupBtn = $('#createGroupBtn');

    if (!loginBtn || !userBtn) return;

    if (u) {
        loginBtn.hidden = true;
        userBtn.hidden = false;

        const initial = (u.displayName || 'U')[0].toUpperCase();
        if (navAvatar) navAvatar.innerHTML = u.avatar ? '<img src="' + u.avatar + '">' : initial;

        if (drawerUser) drawerUser.hidden = false;
        if (drawerAvatar) drawerAvatar.innerHTML = u.avatar ? '<img src="' + u.avatar + '">' : initial;
        if (drawerName) drawerName.innerHTML = escapeHtml(u.displayName) + badgesHtml(u);
        if (drawerUsername) drawerUsername.textContent = '@' + u.username;
        if (drawerLoginBtn) drawerLoginBtn.hidden = true;

        const canPost = u.role === 'admin' || u.role === 'editor' || u.role === 'author';
        if (drawerNewPost) drawerNewPost.hidden = !canPost;
        if (heroNewPost) heroNewPost.hidden = !canPost;
        if (createGroupBtn) createGroupBtn.hidden = u.role !== 'admin';
        if (drawerAdminBtn) drawerAdminBtn.hidden = u.role !== 'admin';
        if (drawerEditorBtn) drawerEditorBtn.hidden = !(u.role === 'admin' || u.role === 'editor');
        if (drawerAuthorBtn) drawerAuthorBtn.hidden = !(u.role === 'admin' || u.role === 'editor' || u.role === 'author');

        updateBadges();
    } else {
        loginBtn.hidden = false;
        userBtn.hidden = true;
        if (drawerUser) drawerUser.hidden = true;
        if (drawerLoginBtn) drawerLoginBtn.hidden = false;
        if (drawerNewPost) drawerNewPost.hidden = true;
        if (heroNewPost) heroNewPost.hidden = true;
        if (createGroupBtn) createGroupBtn.hidden = true;
        if (drawerAdminBtn) drawerAdminBtn.hidden = true;
        if (drawerEditorBtn) drawerEditorBtn.hidden = true;
        if (drawerAuthorBtn) drawerAuthorBtn.hidden = true;
    }
}

function updateBadges() {
    if (!State.user) return;

    const notifCount = $('#notifCount');
    const msgCount = $('#msgCount');
    const friendCount = $('#friendCount');
    const navNotifDot = $('#navNotifDot');

    const notifs = DB.getNotifs().filter(n => n.userId === State.user.id && !n.read);
    const msgs = DB.getMessages().filter(m => m.to === State.user.id && !m.read);
    const reqs = (State.user.friendRequests || []).length;

    if (notifCount) {
        notifCount.hidden = notifs.length === 0;
        notifCount.textContent = faNum(notifs.length);
    }
    if (msgCount) {
        msgCount.hidden = msgs.length === 0;
        msgCount.textContent = faNum(msgs.length);
    }
    if (friendCount) {
        friendCount.hidden = reqs === 0;
        friendCount.textContent = faNum(reqs);
    }
    if (navNotifDot) navNotifDot.hidden = notifs.length === 0;
}

/* ═══════ Router ═══════ */
function showPage(page, data) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');

    State.page = page;
    State.pageData = data || null;
    window.scrollTo(0, 0);

    const titles = {
        home: 'نووا گیم', post: 'پست', groups: 'گروه‌ها', group: 'چت',
        users: 'کاربران', activity: 'فعالیت‌ها', about: 'درباره ما',
        cinema: 'سینما', games: 'بازی', profile: 'پروفایل'
    };
    document.title = (titles[page] || 'نووا گیم') + ' | Nova Game';

    if (page === 'home') renderHome();
    if (page === 'post') renderPostPage(data);
    if (page === 'groups') renderGroupsPage();
    if (page === 'group') renderGroupPage(data);
    if (page === 'users') renderUsersPage();
    if (page === 'activity') renderActivityPage();
    if (page === 'profile') renderProfilePage(data);
}

/* ═══════ Home ═══════ */
function renderHome() {
    renderPosts();
    renderTrending();
    renderHomeGroups();
}

function getFilteredPosts() {
    let posts = DB.getPosts().filter(p => p.status === 'published');
    if (State.postFilter === 'editor') posts = posts.filter(p => p.editorChoice === true);
    else if (State.postFilter === 'discussed') posts.sort((a, b) => ((b.comments || []).length) - ((a.comments || []).length));
    else if (State.postFilter === 'popular') posts.sort((a, b) => (b.views || 0) - (a.views || 0));
    else posts.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return b.createdAt - a.createdAt;
    });
    return posts;
}

function renderPosts() {
    const grid = $('#postsGrid');
    if (!grid) return;
    const posts = getFilteredPosts();
    if (!posts.length) {
        grid.innerHTML = '<div class="empty-state"><h3>هنوز پستی نیست</h3><p>وقتی اولین پست منتشر بشه، اینجا نشون داده می‌شه</p></div>';
        return;
    }
    grid.innerHTML = '';
    posts.slice(0, 9).forEach(p => grid.appendChild(createPostCard(p)));
}

function createPostCard(post) {
    const card = document.createElement('article');
    card.className = 'post-card';

    const catLabel = { news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی' }[post.category] || 'خبر';
    let coverHtml = post.cover ? '<img src="' + post.cover + '" alt="">' : '';
    let pinHtml = post.pinned ? '<span class="post-card-pin">پین</span>' : '';

    card.innerHTML =
        '<div class="post-card-cover" style="' + (post.cover ? '' : 'background:linear-gradient(135deg,var(--accent),var(--accent-2));') + '">' +
            coverHtml + '<span class="post-card-badge">' + catLabel + '</span>' + pinHtml +
        '</div>' +
        '<div class="post-card-body">' +
            '<h3 class="post-card-title">' + escapeHtml(post.title) + '</h3>' +
            '<p class="post-card-excerpt">' + escapeHtml(post.excerpt || stripHtml(post.content).slice(0, 120)) + '</p>' +
            '<div class="post-card-meta">' +
                '<span>' + timeAgo(post.createdAt) + '</span>' +
                '<span>·</span>' +
                '<span>' + faNum(post.views || 0) + ' بازدید</span>' +
            '</div>' +
        '</div>';

    card.addEventListener('click', () => showPage('post', post.id));
    return card;
}

function renderTrending() {
    const grid = $('#trendingGrid');
    if (!grid) return;
    let posts = DB.getPosts().filter(p => p.status === 'published');
    const now = Date.now();
    const ranges = { day: 86400000, week: 604800000, month: 2592000000 };
    const range = ranges[State.timeFilter] || ranges.day;
    posts = posts.filter(p => (now - p.createdAt) < range);
    posts.sort((a, b) => (b.views || 0) - (a.views || 0));

    if (!posts.length) {
        grid.innerHTML = '<div class="empty-state"><h3>چیزی برای نمایش نیست</h3></div>';
        return;
    }
    grid.innerHTML = '';
    posts.slice(0, 6).forEach(p => grid.appendChild(createPostCard(p)));
}

function renderHomeGroups() {
    const grid = $('#homeGroupsGrid');
    if (!grid) return;
    const groups = DB.getGroups().filter(g => g.type === 'public').slice(0, 3);
    if (!groups.length) {
        grid.innerHTML = '<div class="empty-state"><h3>هنوز گروهی نیست</h3></div>';
        return;
    }
    grid.innerHTML = '';
    groups.forEach(g => grid.appendChild(createGroupCard(g)));
}

/* ═══════ Post Page ═══════ */
function renderPostPage(postId) {
    const box = $('#postContent');
    if (!box) return;

    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) {
        box.innerHTML = '<div class="empty-state"><h3>پست پیدا نشد</h3></div>';
        return;
    }

    post.views = (post.views || 0) + 1;
    DB.setPosts(posts);

    const author = getUserById(post.authorId);
    const catLabel = { news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی' }[post.category] || 'خبر';
    const importanceClass = post.importance === 'urgent' ? 'urgent' : (post.importance === 'important' ? 'important' : '');

    let coverHtml = post.cover ? '<div class="post-page-cover"><img src="' + post.cover + '" alt=""></div>' : '';
    let editedHtml = post.edited ? '<span class="edited-tag">(ویرایش‌شده)</span>' : '';

    const canEdit = State.user && (State.user.id === post.authorId || State.user.role === 'admin' || State.user.role === 'editor');
    const canDelete = State.user && (State.user.id === post.authorId || State.user.role === 'admin');

    let actionsHtml = '';
    if (canEdit || canDelete) {
        actionsHtml = '<div class="post-page-actions">';
        if (canEdit) actionsHtml += '<button class="btn-ghost small" id="editPostBtn" type="button">ویرایش پست</button>';
        if (canDelete) actionsHtml += '<button class="btn-ghost small danger" id="deletePostBtn" type="button">حذف پست</button>';
        actionsHtml += '</div>';
    }

    const metaCat = catLabel + (post.score ? ' · ' + faNum(post.score) + '/۱۰' : '') + (post.editorChoice ? ' · انتخاب سردبیر' : '');

    let commentFormHtml = '';
    if (State.user) {
        commentFormHtml =
            '<div class="comment-form">' +
                '<div class="comment-editor" id="commentEditor" contenteditable="true" data-placeholder="نظرت رو بنویس"></div>' +
                '<div class="comment-toolbar">' +
                    '<button type="button" data-cmd="bold" title="ضخیم"><b>B</b></button>' +
                    '<button type="button" data-cmd="italic" title="کج"><i>I</i></button>' +
                    '<button type="button" data-cmd="underline" title="زیرخط"><u>U</u></button>' +
                    '<span class="sep"></span>' +
                    '<button type="button" id="btnSpoiler" title="اسپویلر">اسپویلر</button>' +
                    '<button type="button" id="btnCode" title="کد">کد</button>' +
                    '<button type="button" id="btnMention" title="منشن">@</button>' +
                    '<button type="button" id="btnColorPicker" title="رنگ">رنگ</button>' +
                    '<button type="button" id="btnRainbow" title="رقص نور">رقص نور</button>' +
                '</div>' +
                '<div class="color-picker" id="colorPicker" hidden>' +
                    '<input type="color" id="customColor" title="رنگ دلخواه">' +
                    '<div class="color-dot" style="background:#0a0f1e;" data-color="#0a0f1e"></div>' +
                    '<div class="color-dot" style="background:#dc2626;" data-color="#dc2626"></div>' +
                    '<div class="color-dot" style="background:#ea580c;" data-color="#ea580c"></div>' +
                    '<div class="color-dot" style="background:#d97706;" data-color="#d97706"></div>' +
                    '<div class="color-dot" style="background:#16a34a;" data-color="#16a34a"></div>' +
                    '<div class="color-dot" style="background:#2563eb;" data-color="#2563eb"></div>' +
                    '<div class="color-dot" style="background:#7c3aed;" data-color="#7c3aed"></div>' +
                    '<div class="color-dot" style="background:#d1006b;" data-color="#d1006b"></div>' +
                '</div>' +
                '<div class="comment-actions">' +
                    '<small style="font-size:11px;color:var(--tx-mute);"><span id="charCount">۰</span> کاراکتر</small>' +
                    '<button class="btn-primary small" id="submitComment" type="button">ارسال</button>' +
                '</div>' +
            '</div>';
    } else {
        commentFormHtml = '<div class="comment-form" style="text-align:center;padding:24px;">' +
            '<p style="font-size:13px;color:var(--tx-mute);margin-bottom:10px;">برای کامنت گذاشتن اول وارد شو</p>' +
            '<button class="btn-primary small" id="loginToComment" type="button">ورود</button></div>';
    }

    let comments = (post.comments || []).filter(c => c.status !== 'pending' || (State.user && c.userId === State.user.id) || (State.user && State.user.role === 'admin'));
    if (State.user) comments = comments.filter(c => !isBlocked(State.user.id, c.userId));

    let commentsHtml = comments.length
        ? comments.map(c => renderComment(c, post.id, 0)).join('')
        : '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز نظری نیست. اولین نفر باش</p>';

    box.innerHTML =
        coverHtml +
        '<div class="post-page-header">' +
            '<span class="post-page-cat ' + importanceClass + '">' + metaCat + '</span>' +
            '<h1 class="post-page-title">' + escapeHtml(post.title) + '</h1>' +
            '<div class="post-page-meta">' +
                '<div class="author">' +
                    '<div class="user-avatar">' + (post.authorAvatar ? '<img src="' + post.authorAvatar + '">' : ((post.authorName || 'N')[0])) + '</div>' +
                    '<strong>' + escapeHtml(post.authorName || 'ناشناس') + '</strong>' + (author ? badgesHtml(author) : '') +
                '</div>' +
                '<span>·</span>' +
                '<span>' + timeAgo(post.createdAt) + ' ' + editedHtml + '</span>' +
                '<span>·</span>' +
                '<span>' + faNum(post.views) + ' بازدید</span>' +
            '</div>' + actionsHtml +
        '</div>' +
        '<div class="post-page-body">' + post.content + '</div>' +
        '<div class="comments-section">' +
            '<div class="comments-head"><h3>نظرات <span>(' + faNum(comments.length) + ')</span></h3></div>' +
            commentFormHtml +
            '<div class="comment-list" id="commentList">' + commentsHtml + '</div>' +
        '</div>';

    initCommentEditor(post.id);

    const editBtn = $('#editPostBtn');
    if (editBtn) editBtn.addEventListener('click', () => openEditor(post.id));

    const delBtn = $('#deletePostBtn');
    if (delBtn) delBtn.addEventListener('click', () => {
        if (!confirm('پست حذف بشه؟')) return;
        DB.setPosts(DB.getPosts().filter(p => p.id !== post.id));
        toast('پست حذف شد');
        showPage('home');
    });
}

function renderComment(comment, postId, level) {
    const user = getUserById(comment.userId);
    const name = user ? user.displayName : (comment.userName || 'ناشناس');
    const avatar = user ? user.avatar : comment.userAvatar;
    const initial = name[0].toUpperCase();

    const likes = comment.likes || [];
    const dislikes = comment.dislikes || [];
    const userLiked = State.user && likes.indexOf(State.user.id) > -1;
    const userDisliked = State.user && dislikes.indexOf(State.user.id) > -1;

    let reactionsHtml = '';
    if (likes.length || dislikes.length) {
        const users = DB.getUsers();
        let avatars = '';
        likes.slice(0, 5).forEach(lid => {
            const lu = users.find(u => u.id === lid);
            if (lu) {
                const init = (lu.displayName || 'U')[0].toUpperCase();
                avatars += '<div class="reaction-avatar" title="' + escapeHtml(lu.displayName) + '">' +
                    (lu.avatar ? '<img src="' + lu.avatar + '">' : init) + '</div>';
            }
        });
        reactionsHtml = '<div class="reactions-list">' + avatars +
            (likes.length > 5 ? '<span class="reaction-count">+' + faNum(likes.length - 5) + '</span>' : '') +
            (likes.length ? '<span class="reaction-count">' + faNum(likes.length) + ' لایک</span>' : '') +
            '</div>';
    }

    const age = (Date.now() - comment.createdAt) / 1000;
    const editLimit = (user && user.tick === 'gold') ? Infinity : 120;
    const canEdit = State.user && State.user.id === comment.userId && age < editLimit;
    const canDelete = State.user && (State.user.id === comment.userId || State.user.role === 'admin');

    const pendingBadge = comment.status === 'pending' ? '<span class="comment-pending-badge">در انتظار تأیید</span>' : '';
    const editedTag = comment.edited ? '<span class="edited-tag">(ویرایش‌شده)</span>' : '';

    let repliesHtml = '';
    if (comment.replies && comment.replies.length && level < 5) {
        repliesHtml = '<div class="comment-replies">' +
            comment.replies.map(r => renderComment(r, postId, level + 1)).join('') + '</div>';
    }

    return '<div class="comment-item ' + (comment.status === 'pending' ? 'pending' : '') + '" data-comment-id="' + comment.id + '">' +
        '<div class="comment-item-header">' +
            '<div class="user-avatar">' + (avatar ? '<img src="' + avatar + '">' : initial) + '</div>' +
            '<div class="user-name">' +
                '<strong>' + escapeHtml(name) + (user ? badgesHtml(user) : '') + '</strong>' +
                '<small>@' + escapeHtml(user ? user.username : 'user') + '</small>' +
            '</div>' +
            '<span class="time">' + timeAgo(comment.createdAt) + ' ' + editedTag + '</span>' + pendingBadge +
        '</div>' +
        '<div class="comment-item-body">' + comment.content + '</div>' +
        '<div class="comment-item-footer">' +
            '<button class="comment-btn ' + (userLiked ? 'liked' : '') + '" data-like="' + comment.id + '" type="button">لایک ' + faNum(likes.length) + '</button>' +
            '<button class="comment-btn ' + (userDisliked ? 'disliked' : '') + '" data-dislike="' + comment.id + '" type="button">دیس‌لایک ' + faNum(dislikes.length) + '</button>' +
            (level < 5 ? '<button class="comment-btn" data-reply="' + comment.id + '" type="button">پاسخ</button>' : '') +
            (canEdit ? '<button class="comment-btn" data-edit-comment="' + comment.id + '" type="button">ویرایش</button>' : '') +
            (canDelete ? '<button class="comment-btn" data-delete="' + comment.id + '" type="button">حذف</button>' : '') +
        '</div>' +
        reactionsHtml + repliesHtml +
    '</div>';
}

function initCommentEditor(postId) {
    const editor = $('#commentEditor');
    if (!editor) {
        const lb = $('#loginToComment');
        if (lb) lb.addEventListener('click', () => openModal('authOverlay'));
        initCommentActions(postId);
        return;
    }

    const submitBtn = $('#submitComment');
    const charCount = $('#charCount');

    $$('.comment-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, null);
            editor.focus();
        });
    });

    const bS = $('#btnSpoiler');
    if (bS) bS.addEventListener('click', () => {
        const sel = window.getSelection().toString() || 'متن مخفی';
        document.execCommand('insertHTML', false,
            '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + escapeHtml(sel) + '</span>');
        editor.focus();
    });

    const bC = $('#btnCode');
    if (bC) bC.addEventListener('click', () => {
        const t = prompt('کد:');
        if (t) document.execCommand('insertHTML', false, '<code>' + escapeHtml(t) + '</code>');
        editor.focus();
    });

    const bM = $('#btnMention');
    if (bM) bM.addEventListener('click', () => {
        const users = DB.getUsers().slice(0, 8).map(u => u.username).join('، ');
        const u = prompt('نام کاربری:\n' + users);
        if (u) document.execCommand('insertHTML', false, '@' + u + ' ');
        editor.focus();
    });

    const bCP = $('#btnColorPicker');
    if (bCP) bCP.addEventListener('click', () => {
        const cp = $('#colorPicker');
        if (cp) cp.hidden = !cp.hidden;
    });

    const cc = $('#customColor');
    if (cc) cc.addEventListener('input', () => {
        document.execCommand('foreColor', false, cc.value);
        editor.focus();
    });

    $$('.color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.execCommand('foreColor', false, dot.dataset.color);
            editor.focus();
        });
    });

    const bR = $('#btnRainbow');
    if (bR) bR.addEventListener('click', () => {
        const sel = window.getSelection().toString() || 'رقص نور';
        document.execCommand('insertHTML', false, '<span class="rainbow-text">' + escapeHtml(sel) + '</span>');
        editor.focus();
    });

    editor.addEventListener('input', () => {
        if (charCount) charCount.textContent = faNum(editor.textContent.length);
    });

    if (submitBtn) submitBtn.addEventListener('click', () => {
        const content = editor.innerHTML.trim();
        if (!content || editor.textContent.trim().length < 2) { toast('نظرت خیلی کوتاهه'); return; }
        addComment(postId, content);
        editor.innerHTML = '';
        if (charCount) charCount.textContent = '۰';
    });

    initCommentActions(postId);
}

function initCommentActions(postId) {
    const list = $('#commentList');
    if (!list) return;

    list.addEventListener('click', e => {
        const like = e.target.closest('[data-like]');
        const dislike = e.target.closest('[data-dislike]');
        const reply = e.target.closest('[data-reply]');
        const del = e.target.closest('[data-delete]');
        const editBtn = e.target.closest('[data-edit-comment]');

        if (like) toggleCommentReaction(postId, like.dataset.like, 'like');
        if (dislike) toggleCommentReaction(postId, dislike.dataset.dislike, 'dislike');
        if (reply) replyToComment(postId, reply.dataset.reply);
        if (editBtn) editComment(postId, editBtn.dataset.editComment);
        if (del && confirm('حذف بشه؟')) deleteComment(postId, del.dataset.delete);
    });
}

function findCommentInList(list, id) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
        if (list[i].replies && list[i].replies.length) {
            const f = findCommentInList(list[i].replies, id);
            if (f) return f;
        }
    }
    return null;
}

function addComment(postId, content) {
    if (!State.user) return;
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const u = State.user;
    const needsApproval = !u.tick && u.role !== 'admin' && u.role !== 'editor';
    const status = needsApproval ? 'pending' : 'approved';

    const comment = {
        id: uid('c_'), userId: u.id, userName: u.displayName, userAvatar: u.avatar,
        content: parseMentions(content), createdAt: Date.now(),
        likes: [], dislikes: [], replies: [], status, edited: false
    };

    if (needsApproval) {
        const pending = DB.getPending();
        pending.push({ comment, postId, addedAt: Date.now() });
        DB.setPending(pending);
        const notifs = DB.getNotifs();
        DB.getUsers().filter(x => x.role === 'admin').forEach(adm => {
            notifs.push({
                id: uid('n_'), userId: adm.id, type: 'pending_comment',
                text: 'کامنت جدید در انتظار تأیید از ' + u.displayName,
                ts: Date.now(), read: false
            });
        });
        DB.setNotifs(notifs);
        toast('نظرت ثبت شد و در انتظار تأیید مدیره');
    } else {
        post.comments = post.comments || [];
        post.comments.push(comment);
        DB.setPosts(posts);
        addActivity('comment', u.displayName + ' روی پست «' + post.title + '» نظر داد');
        toast('نظرت ثبت شد');
    }
    renderPostPage(postId);
}

function toggleCommentReaction(postId, commentId, type) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const comment = findCommentInList(post.comments || [], commentId);
    if (!comment) return;

    comment.likes = comment.likes || [];
    comment.dislikes = comment.dislikes || [];

    if (type === 'like') {
        comment.dislikes = comment.dislikes.filter(id => id !== State.user.id);
        if (comment.likes.indexOf(State.user.id) > -1) comment.likes = comment.likes.filter(id => id !== State.user.id);
        else comment.likes.push(State.user.id);
    } else {
        comment.likes = comment.likes.filter(id => id !== State.user.id);
        if (comment.dislikes.indexOf(State.user.id) > -1) comment.dislikes = comment.dislikes.filter(id => id !== State.user.id);
        else comment.dislikes.push(State.user.id);
    }

    DB.setPosts(posts);
    renderPostPage(postId);
}

function replyToComment(postId, commentId) {
    const text = prompt('پاسخ:');
    if (!text || !text.trim() || !State.user) return;

    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const comment = findCommentInList(post.comments || [], commentId);
    if (!comment) return;

    comment.replies = comment.replies || [];
    comment.replies.push({
        id: uid('c_'), userId: State.user.id, userName: State.user.displayName,
        userAvatar: State.user.avatar, content: escapeHtml(text), createdAt: Date.now(),
        likes: [], dislikes: [], replies: [], status: 'approved', edited: false
    });

    DB.setPosts(posts);
    renderPostPage(postId);
}

function editComment(postId, commentId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = findCommentInList(post.comments || [], commentId);
    if (!comment) return;

    const newText = prompt('متن جدید:', stripHtml(comment.content));
    if (!newText || !newText.trim()) return;

    comment.content = escapeHtml(newText);
    comment.edited = true;
    comment.editedAt = Date.now();
    DB.setPosts(posts);
    renderPostPage(postId);
    toast('ویرایش شد');
}

function deleteComment(postId, commentId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    function removeFrom(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === commentId) { list.splice(i, 1); return true; }
            if (list[i].replies && list[i].replies.length && removeFrom(list[i].replies)) return true;
        }
        return false;
    }

    if (removeFrom(post.comments || [])) {
        DB.setPosts(posts);
        renderPostPage(postId);
        toast('حذف شد');
    }
}

/* ═══════ Auto approve pending ═══════ */
function checkPendingAutoApprove() {
    const pend = DB.getPending();
    if (!pend.length) return;
    const now = Date.now();
    const HOUR = 3600000;
    let changed = false;

    for (let i = pend.length - 1; i >= 0; i--) {
        if (now - pend[i].addedAt >= HOUR) {
            const posts = DB.getPosts();
            const post = posts.find(p => p.id === pend[i].postId);
            if (post) {
                post.comments = post.comments || [];
                pend[i].comment.status = 'approved';
                post.comments.push(pend[i].comment);
                DB.setPosts(posts);
            }
            pend.splice(i, 1);
            changed = true;
        }
    }
    if (changed) DB.setPending(pend);
}

/* ═══════ Groups ═══════ */
function renderGroupsPage() {
    const grid = $('#groupsGrid');
    if (!grid) return;
    let groups = DB.getGroups();
    if (State.groupFilter === 'public') groups = groups.filter(g => g.type === 'public');
    else if (State.groupFilter === 'private') groups = groups.filter(g => g.type === 'private');
    else if (State.groupFilter === 'mine') {
        if (!State.user) groups = [];
        else groups = groups.filter(g => (State.user.groups || []).indexOf(g.id) > -1);
    }

    if (!groups.length) {
        grid.innerHTML = '<div class="empty-state"><h3>گروهی نیست</h3></div>';
        return;
    }
    grid.innerHTML = '';
    groups.forEach(g => grid.appendChild(createGroupCard(g)));
}

function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';
    const typeLabel = group.type === 'public' ? 'عمومی' : 'خصوصی';
    let coverStyle = 'background:linear-gradient(135deg,var(--accent),var(--accent-2));';
    if (group.cover) coverStyle = "background:url('" + group.cover + "') center/cover;";

    card.innerHTML =
        '<div class="group-card-cover" style="' + coverStyle + '">' +
            '<span class="group-card-type ' + group.type + '">' + typeLabel + '</span>' +
        '</div>' +
        '<div class="group-card-body">' +
            '<div class="group-card-avatar">' + (group.avatar ? '<img src="' + group.avatar + '">' : (group.name || 'G')[0].toUpperCase()) + '</div>' +
            '<div class="group-card-info">' +
                '<h3>' + escapeHtml(group.name) + '</h3>' +
                '<p>' + faNum((group.members || []).length) + ' عضو</p>' +
            '</div>' +
        '</div>';

    card.addEventListener('click', () => showPage('group', group.id));
    return card;
}

function renderGroupPage(groupId) {
    const box = $('#groupContent');
    if (!box) return;

    const group = DB.getGroups().find(g => g.id === groupId);
    if (!group) { box.innerHTML = '<div class="empty-state"><h3>گروه پیدا نشد</h3></div>'; return; }

    const u = State.user;
    const myId = u ? u.id : null;
    const isMember = myId && (group.members || []).indexOf(myId) > -1;
    const isOwner = myId && group.ownerId === myId;
    const isAdmin = myId && (group.admins || []).indexOf(myId) > -1;
    const isMod = myId && (group.mods || []).indexOf(myId) > -1;
    const isBanned = myId && (group.banned || []).indexOf(myId) > -1;
    const isSiteAdmin = u && u.role === 'admin';

    if (group.type === 'private' && !isMember && !isOwner && !isAdmin && !isMod && !isSiteAdmin) {
        if (isBanned) { box.innerHTML = '<div class="empty-state"><h3>از این گروه بن شدی</h3></div>'; return; }
        box.innerHTML = '<div class="empty-state"><h3>گروه خصوصی</h3><p>برای ورود درخواست بده</p>' +
            '<button class="btn-primary" id="requestJoinBtn" type="button" style="margin-top:14px;">درخواست عضویت</button></div>';
        const rj = $('#requestJoinBtn');
        if (rj) rj.addEventListener('click', () => requestJoinGroup(groupId));
        return;
    }

    const users = DB.getUsers();
    const owner = users.find(x => x.id === group.ownerId);
    let teamHtml = '';
    if (owner) {
        teamHtml += '<div class="team-member owner" data-user-id="' + owner.id + '">' +
            '<div class="user-avatar">' + (owner.avatar ? '<img src="' + owner.avatar + '">' : owner.displayName[0]) + '</div>' +
            '<span class="team-name">' + escapeHtml(owner.displayName) + '</span>' +
            '<svg class="team-role-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg></div>';
    }
    (group.admins || []).forEach(aid => {
        const au = users.find(x => x.id === aid);
        if (!au) return;
        teamHtml += '<div class="team-member admin" data-user-id="' + au.id + '">' +
            '<div class="user-avatar">' + (au.avatar ? '<img src="' + au.avatar + '">' : au.displayName[0]) + '</div>' +
            '<span class="team-name">' + escapeHtml(au.displayName) + '</span></div>';
    });
    (group.mods || []).forEach(mid => {
        const mu = users.find(x => x.id === mid);
        if (!mu) return;
        teamHtml += '<div class="team-member mod" data-user-id="' + mu.id + '">' +
            '<div class="user-avatar">' + (mu.avatar ? '<img src="' + mu.avatar + '">' : mu.displayName[0]) + '</div>' +
            '<span class="team-name">' + escapeHtml(mu.displayName) + '</span></div>';
    });

    const teamSection = teamHtml
        ? '<div class="group-team"><span class="group-team-label">تیم مدیریت</span><div class="group-team-list">' + teamHtml + '</div></div>'
        : '';

    let messages = group.messages || [];
    if (myId) messages = messages.filter(m => !isBlocked(myId, m.userId));
    const visible = messages.slice(-20);

    let messagesHtml = '';
    if (messages.length > 20) messagesHtml += '<button class="chat-load-more" id="loadMoreMsgs" type="button">نمایش پیام‌های قدیمی‌تر</button>';
    messagesHtml += visible.map(m => renderChatMessage(m, group, 0)).join('');
    if (!visible.length) messagesHtml += '<p style="text-align:center;color:var(--tx-mute);padding:30px;font-size:13px;">هنوز پیامی نیست</p>';

    let actionsHtml = '';
    if (isOwner || isAdmin || isMod || isSiteAdmin) actionsHtml += '<button class="btn-ghost small" id="groupSettingsBtn" type="button">تنظیمات</button>';
    if (!isMember && group.type === 'public' && !isBanned) actionsHtml += '<button class="btn-primary small" id="joinGroupBtn" type="button">عضویت</button>';
    if (isBanned) actionsHtml += '<span class="role-badge" style="background:rgba(220,38,38,.15);color:var(--bad);padding:6px 12px;border-radius:100px;font-size:11px;">بن شده</span>';

    let inputHtml = '';
    if (isMember || isOwner || isAdmin || isMod) {
        inputHtml = '<div class="chat-input-wrap">' +
            '<div class="chat-editor" id="chatEditor" contenteditable="true" data-placeholder="پیامت رو بنویس"></div>' +
            '<div class="chat-toolbar">' +
                '<div class="chat-toolbar-left">' +
                    '<button type="button" data-cmd="bold"><b>B</b></button>' +
                    '<button type="button" data-cmd="italic"><i>I</i></button>' +
                    '<button type="button" id="chatSpoiler">اسپویلر</button>' +
                    '<button type="button" id="chatColor">رنگ</button>' +
                    '<button type="button" id="chatRainbow">رقص نور</button>' +
                    '<button type="button" id="chatImage">تصویر</button>' +
                '</div>' +
                '<div class="chat-toolbar-right">' +
                    '<button type="button" class="chat-send-btn" id="chatSend">ارسال</button>' +
                '</div>' +
            '</div>' +
            '<div class="color-picker" id="chatColorPicker" hidden style="margin-top:8px;">' +
                '<input type="color" id="chatCustomColor">' +
                '<div class="color-dot" style="background:#dc2626;" data-color="#dc2626"></div>' +
                '<div class="color-dot" style="background:#ea580c;" data-color="#ea580c"></div>' +
                '<div class="color-dot" style="background:#d97706;" data-color="#d97706"></div>' +
                '<div class="color-dot" style="background:#16a34a;" data-color="#16a34a"></div>' +
                '<div class="color-dot" style="background:#2563eb;" data-color="#2563eb"></div>' +
                '<div class="color-dot" style="background:#7c3aed;" data-color="#7c3aed"></div>' +
                '<div class="color-dot" style="background:#d1006b;" data-color="#d1006b"></div>' +
            '</div></div>';
    } else {
        inputHtml = '<div class="chat-input-wrap" style="text-align:center;padding:16px;">' +
            '<p style="font-size:12px;color:var(--tx-mute);">' +
            (isBanned ? 'تو بن شدی، نمی‌تونی پیام بفرستی' : 'عضو نیستی') + '</p></div>';
    }

    box.innerHTML =
        '<div class="group-page-header">' +
            '<div class="group-page-avatar">' + (group.avatar ? '<img src="' + group.avatar + '">' : (group.name || 'G')[0].toUpperCase()) + '</div>' +
            '<div class="group-page-info"><h1>' + escapeHtml(group.name) + '</h1>' +
                '<p><span>' + (group.type === 'public' ? 'عمومی' : 'خصوصی') + '</span>' +
                '<span>' + faNum((group.members || []).length) + ' عضو</span>' +
                '<span>' + faNum(messages.length) + ' پیام</span></p></div>' +
            '<div class="group-page-actions">' + actionsHtml + '</div>' +
        '</div>' + teamSection +
        '<div class="chat-box"><div class="chat-messages" id="chatMessages">' + messagesHtml + '</div>' + inputHtml + '</div>';

    initChat(groupId);

    const gsb = $('#groupSettingsBtn');
    if (gsb) gsb.addEventListener('click', () => openGroupSettings(groupId));
    const jb = $('#joinGroupBtn');
    if (jb) jb.addEventListener('click', () => joinGroup(groupId));

    $$('.team-member').forEach(el => {
        el.addEventListener('click', () => el.dataset.userId && showPage('profile', el.dataset.userId));
    });

    setTimeout(() => {
        const cm = $('#chatMessages');
        if (cm) cm.scrollTop = cm.scrollHeight;
    }, 100);
}

function renderChatMessage(msg, group, level) {
    const user = getUserById(msg.userId);
    const name = user ? user.displayName : (msg.userName || 'ناشناس');
    const avatar = user ? user.avatar : msg.userAvatar;
    const initial = name[0].toUpperCase();

    let roleBadge = '';
    if (group.ownerId === msg.userId) roleBadge = '<span class="role-badge owner">مدیر</span>';
    else if ((group.admins || []).indexOf(msg.userId) > -1) roleBadge = '<span class="role-badge admin">ادمین</span>';
    else if ((group.mods || []).indexOf(msg.userId) > -1) roleBadge = '<span class="role-badge mod">ناظر</span>';

    const userLiked = State.user && (msg.likes || []).indexOf(State.user.id) > -1;
    const userDisliked = State.user && (msg.dislikes || []).indexOf(State.user.id) > -1;

    const imageHtml = msg.image ? '<img src="' + msg.image + '" class="chat-msg-image" onclick="window.open(this.src)">' : '';
    const age = (Date.now() - msg.createdAt) / 1000;
    const canEdit = State.user && State.user.id === msg.userId && age < 600;
    const canDelete = State.user && (
        State.user.id === msg.userId ||
        group.ownerId === State.user.id ||
        (group.admins || []).indexOf(State.user.id) > -1 ||
        (group.mods || []).indexOf(State.user.id) > -1
    );

    let repliesHtml = '';
    if (msg.replies && msg.replies.length && level < 5) {
        repliesHtml = '<div class="chat-replies">' +
            msg.replies.map(r => renderChatReply(r, group, level + 1, msg.id)).join('') + '</div>';
    }

    const editedTag = msg.edited ? '<span class="edited-tag">(ویرایش‌شده)</span>' : '';

    return '<div class="chat-msg" data-msg-id="' + msg.id + '">' +
        '<div class="user-avatar">' + (avatar ? '<img src="' + avatar + '">' : initial) + '</div>' +
        '<div class="chat-msg-content">' +
            '<div class="chat-msg-head"><strong>' + escapeHtml(name) + '</strong>' + (user ? badgesHtml(user) : '') + roleBadge +
                '<span class="time">' + timeAgo(msg.createdAt) + ' ' + editedTag + '</span></div>' +
            '<div class="chat-msg-body">' + (msg.content || '') + '</div>' + imageHtml +
            '<div class="chat-msg-actions">' +
                '<button class="chat-msg-btn ' + (userLiked ? 'liked' : '') + '" data-msg-like="' + msg.id + '" type="button">لایک ' + faNum((msg.likes || []).length) + '</button>' +
                '<button class="chat-msg-btn ' + (userDisliked ? 'disliked' : '') + '" data-msg-dislike="' + msg.id + '" type="button">دیس‌لایک ' + faNum((msg.dislikes || []).length) + '</button>' +
                '<button class="chat-msg-btn" data-msg-reply="' + msg.id + '" type="button">پاسخ</button>' +
                (canEdit ? '<button class="chat-msg-btn" data-msg-edit="' + msg.id + '" type="button">ویرایش</button>' : '') +
                (canDelete ? '<button class="chat-msg-btn" data-msg-del="' + msg.id + '" type="button">حذف</button>' : '') +
            '</div>' + repliesHtml +
        '</div></div>';
}

function renderChatReply(reply, group, level, parentMsgId) {
    const user = getUserById(reply.userId);
    const name = user ? user.displayName : (reply.userName || 'ناشناس');
    const avatar = user ? user.avatar : reply.userAvatar;
    const initial = name[0].toUpperCase();

    const userLiked = State.user && (reply.likes || []).indexOf(State.user.id) > -1;
    const userDisliked = State.user && (reply.dislikes || []).indexOf(State.user.id) > -1;

    const age = (Date.now() - reply.createdAt) / 1000;
    const canEdit = State.user && State.user.id === reply.userId && age < 600;
    const canDelete = State.user && (
        State.user.id === reply.userId ||
        group.ownerId === State.user.id ||
        (group.admins || []).indexOf(State.user.id) > -1 ||
        (group.mods || []).indexOf(State.user.id) > -1
    );

    let nestedHtml = '';
    if (reply.replies && reply.replies.length && level < 5) {
        nestedHtml = '<div class="chat-replies">' +
            reply.replies.map(r => renderChatReply(r, group, level + 1, reply.id)).join('') + '</div>';
    }

    const editedTag = reply.edited ? '<span class="edited-tag">(ویرایش‌شده)</span>' : '';

    return '<div class="chat-reply" data-reply-id="' + reply.id + '" data-parent-id="' + parentMsgId + '">' +
        '<div class="chat-reply-header">' +
            '<div class="user-avatar">' + (avatar ? '<img src="' + avatar + '">' : initial) + '</div>' +
            '<strong>' + escapeHtml(name) + '</strong>' + (user ? badgesHtml(user) : '') +
            '<span class="time">' + timeAgo(reply.createdAt) + ' ' + editedTag + '</span>' +
        '</div>' +
        '<div class="chat-reply-body">' + (reply.content || '') + '</div>' +
        '<div class="chat-reply-actions">' +
            '<button class="chat-reply-btn ' + (userLiked ? 'liked' : '') + '" data-reply-like="' + reply.id + '" data-parent="' + parentMsgId + '" type="button">لایک ' + faNum((reply.likes || []).length) + '</button>' +
            '<button class="chat-reply-btn ' + (userDisliked ? 'disliked' : '') + '" data-reply-dislike="' + reply.id + '" data-parent="' + parentMsgId + '" type="button">دیس‌لایک ' + faNum((reply.dislikes || []).length) + '</button>' +
            (level < 5 ? '<button class="chat-reply-btn" data-reply-reply="' + reply.id + '" data-parent="' + parentMsgId + '" type="button">پاسخ</button>' : '') +
            (canEdit ? '<button class="chat-reply-btn" data-reply-edit="' + reply.id + '" data-parent="' + parentMsgId + '" type="button">ویرایش</button>' : '') +
            (canDelete ? '<button class="chat-reply-btn" data-reply-del="' + reply.id + '" data-parent="' + parentMsgId + '" type="button">حذف</button>' : '') +
        '</div>' + nestedHtml +
    '</div>';
}

function initChat(groupId) {
    const editor = $('#chatEditor');

    if (editor) {
        $$('.chat-toolbar button[data-cmd]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.execCommand(btn.dataset.cmd, false, null);
                editor.focus();
            });
        });

        const cs = $('#chatSpoiler');
        if (cs) cs.addEventListener('click', () => {
            const sel = window.getSelection().toString() || 'متن مخفی';
            document.execCommand('insertHTML', false,
                '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + escapeHtml(sel) + '</span>');
            editor.focus();
        });

        const cc = $('#chatColor');
        if (cc) cc.addEventListener('click', () => {
            const p = $('#chatColorPicker');
            if (p) p.hidden = !p.hidden;
        });

        const customC = $('#chatCustomColor');
        if (customC) customC.addEventListener('input', () => {
            document.execCommand('foreColor', false, customC.value);
            editor.focus();
        });

        $$('#chatColorPicker .color-dot').forEach(d => {
            d.addEventListener('click', () => {
                document.execCommand('foreColor', false, d.dataset.color);
                editor.focus();
            });
        });

        const rb = $('#chatRainbow');
        if (rb) rb.addEventListener('click', () => {
            const sel = window.getSelection().toString() || 'رقص نور';
            document.execCommand('insertHTML', false, '<span class="rainbow-text">' + escapeHtml(sel) + '</span>');
            editor.focus();
        });

        const ci = $('#chatImage');
        if (ci) ci.addEventListener('click', () => {
            const inp = document.createElement('input');
            inp.type = 'file';
            inp.accept = 'image/*';
            inp.onchange = async () => {
                try {
                    const b64 = await fileToBase64(inp.files[0]);
                    sendChatMessage(groupId, null, b64);
                } catch (err) { toast(err); }
            };
            inp.click();
        });

        const csend = $('#chatSend');
        if (csend) csend.addEventListener('click', () => {
            const content = editor.innerHTML.trim();
            if (!content || editor.textContent.trim().length < 1) return;
            sendChatMessage(groupId, content);
            editor.innerHTML = '';
        });

        editor.addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const b = $('#chatSend');
                if (b) b.click();
            }
        });
    }

    const chatBox = $('#chatMessages');
    if (chatBox) {
        chatBox.addEventListener('click', e => {
            const like = e.target.closest('[data-msg-like]');
            const dislike = e.target.closest('[data-msg-dislike]');
            const reply = e.target.closest('[data-msg-reply]');
            const editMsg = e.target.closest('[data-msg-edit]');
            const del = e.target.closest('[data-msg-del]');

            const rLike = e.target.closest('[data-reply-like]');
            const rDislike = e.target.closest('[data-reply-dislike]');
            const rReply = e.target.closest('[data-reply-reply]');
            const rEdit = e.target.closest('[data-reply-edit]');
            const rDel = e.target.closest('[data-reply-del]');

            if (like) toggleMsgReaction(groupId, like.dataset.msgLike, 'like');
            if (dislike) toggleMsgReaction(groupId, dislike.dataset.msgDislike, 'dislike');
            if (reply) replyToMessage(groupId, reply.dataset.msgReply);
            if (editMsg) editMessage(groupId, editMsg.dataset.msgEdit);
            if (del && confirm('حذف بشه؟')) deleteMessage(groupId, del.dataset.msgDel);

            if (rLike) toggleReplyReaction(groupId, rLike.dataset.parent, rLike.dataset.replyLike, 'like');
            if (rDislike) toggleReplyReaction(groupId, rDislike.dataset.parent, rDislike.dataset.replyDislike, 'dislike');
            if (rReply) replyToReply(groupId, rReply.dataset.parent, rReply.dataset.replyReply);
            if (rEdit) editReply(groupId, rEdit.dataset.parent, rEdit.dataset.replyEdit);
            if (rDel && confirm('حذف بشه؟')) deleteReply(groupId, rDel.dataset.parent, rDel.dataset.replyDel);
        });
    }
}

function sendChatMessage(groupId, content, image) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    g.messages = g.messages || [];
    g.messages.push({
        id: uid('m_'), userId: State.user.id, userName: State.user.displayName,
        userAvatar: State.user.avatar, content: content ? parseMentions(content) : '',
        image: image || null, createdAt: Date.now(), likes: [], dislikes: [], replies: [], edited: false
    });
    DB.setGroups(groups);
    addActivity('chat', State.user.displayName + ' توی گروه «' + g.name + '» پیام داد');
    renderGroupPage(groupId);
}

function toggleMsgReaction(groupId, msgId, type) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;

    msg.likes = msg.likes || [];
    msg.dislikes = msg.dislikes || [];
    if (type === 'like') {
        msg.dislikes = msg.dislikes.filter(id => id !== State.user.id);
        if (msg.likes.indexOf(State.user.id) > -1) msg.likes = msg.likes.filter(id => id !== State.user.id);
        else msg.likes.push(State.user.id);
    } else {
        msg.likes = msg.likes.filter(id => id !== State.user.id);
        if (msg.dislikes.indexOf(State.user.id) > -1) msg.dislikes = msg.dislikes.filter(id => id !== State.user.id);
        else msg.dislikes.push(State.user.id);
    }
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function toggleReplyReaction(groupId, parentId, replyId, type) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    function findReply(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findReply(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }

    const msg = (g.messages || []).find(m => m.id === parentId);
    if (!msg) return;
    const r = findReply(msg.replies || []);
    if (!r) return;

    r.likes = r.likes || [];
    r.dislikes = r.dislikes || [];
    if (type === 'like') {
        r.dislikes = r.dislikes.filter(id => id !== State.user.id);
        if (r.likes.indexOf(State.user.id) > -1) r.likes = r.likes.filter(id => id !== State.user.id);
        else r.likes.push(State.user.id);
    } else {
        r.likes = r.likes.filter(id => id !== State.user.id);
        if (r.dislikes.indexOf(State.user.id) > -1) r.dislikes = r.dislikes.filter(id => id !== State.user.id);
        else r.dislikes.push(State.user.id);
    }
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function replyToMessage(groupId, msgId) {
    const text = prompt('پاسخ:');
    if (!text || !State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;
    msg.replies = msg.replies || [];
    msg.replies.push({
        id: uid('r_'), userId: State.user.id, userName: State.user.displayName,
        userAvatar: State.user.avatar, content: parseMentions(escapeHtml(text)),
        createdAt: Date.now(), likes: [], dislikes: [], replies: [], edited: false
    });
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function replyToReply(groupId, parentId, replyId) {
    const text = prompt('پاسخ:');
    if (!text || !State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === parentId);
    if (!msg) return;

    function findReply(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findReply(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }
    const r = findReply(msg.replies || []);
    if (!r) return;
    r.replies = r.replies || [];
    r.replies.push({
        id: uid('r_'), userId: State.user.id, userName: State.user.displayName,
        userAvatar: State.user.avatar, content: escapeHtml(text),
        createdAt: Date.now(), likes: [], dislikes: [], replies: [], edited: false
    });
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function editMessage(groupId, msgId) {
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;
    const newText = prompt('متن جدید:', stripHtml(msg.content));
    if (!newText || !newText.trim()) return;
    msg.content = parseMentions(escapeHtml(newText));
    msg.edited = true;
    DB.setGroups(groups);
    renderGroupPage(groupId);
    toast('ویرایش شد');
}

function editReply(groupId, parentId, replyId) {
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === parentId);
    if (!msg) return;

    function findReply(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findReply(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }
    const r = findReply(msg.replies || []);
    if (!r) return;
    const newText = prompt('متن جدید:', stripHtml(r.content));
    if (!newText || !newText.trim()) return;
    r.content = escapeHtml(newText);
    r.edited = true;
    DB.setGroups(groups);
    renderGroupPage(groupId);
    toast('ویرایش شد');
}

function deleteMessage(groupId, msgId) {
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    g.messages = (g.messages || []).filter(m => m.id !== msgId);
    DB.setGroups(groups);
    renderGroupPage(groupId);
    toast('حذف شد');
}

function deleteReply(groupId, parentId, replyId) {
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === parentId);
    if (!msg) return;

    function removeR(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) { list.splice(i, 1); return true; }
            if (list[i].replies && list[i].replies.length && removeR(list[i].replies)) return true;
        }
        return false;
    }
    if (removeR(msg.replies || [])) {
        DB.setGroups(groups);
        renderGroupPage(groupId);
        toast('حذف شد');
    }
}

function joinGroup(groupId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    if ((g.banned || []).indexOf(State.user.id) > -1) { toast('بن شدی'); return; }

    g.members = g.members || [];
    if (g.members.indexOf(State.user.id) === -1) g.members.push(State.user.id);

    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    if (me) {
        me.groups = me.groups || [];
        if (me.groups.indexOf(groupId) === -1) me.groups.push(groupId);
        DB.setUsers(users);
        State.user = me;
    }
    DB.setGroups(groups);
    toast('عضو شدی');
    renderGroupPage(groupId);
}

function requestJoinGroup(groupId) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    g.joinRequests = g.joinRequests || [];
    if (g.joinRequests.indexOf(State.user.id) === -1) g.joinRequests.push(State.user.id);
    DB.setGroups(groups);

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'), userId: g.ownerId, type: 'group_request',
        text: State.user.displayName + ' درخواست عضویت در گروه «' + g.name + '» داد',
        link: 'group:' + g.id, ts: Date.now(), read: false
    });
    DB.setNotifs(notifs);
    toast('درخواست فرستاده شد');
}

function openGroupSettings(groupId) {
    if (!State.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;

    const isOwner = g.ownerId === State.user.id;
    const isAdmin = (g.admins || []).indexOf(State.user.id) > -1;
    const isMod = (g.mods || []).indexOf(State.user.id) > -1;
    const isSiteAdmin = State.user.role === 'admin';
    if (!isOwner && !isAdmin && !isMod && !isSiteAdmin) { toast('دسترسی نداری'); return; }

    const box = $('#groupSettingsBody');
    if (!box) return;

    const users = DB.getUsers();
    let membersHtml = (g.members || []).map(mid => {
        const u = users.find(x => x.id === mid);
        if (!u) return '';
        const isOwnerM = g.ownerId === mid;
        const isAdminM = (g.admins || []).indexOf(mid) > -1;
        const isModM = (g.mods || []).indexOf(mid) > -1;

        let roleLabel = '';
        if (isOwnerM) roleLabel = '<span class="role-badge owner">مدیر</span>';
        else if (isAdminM) roleLabel = '<span class="role-badge admin">ادمین</span>';
        else if (isModM) roleLabel = '<span class="role-badge mod">ناظر</span>';

        let btns = '';
        if (!isOwnerM && (isOwner || isAdmin || isSiteAdmin)) {
            if (isOwner || isSiteAdmin) btns += '<button class="btn-ghost small" data-promote-admin="' + mid + '" type="button">ادمین</button>';
            btns += '<button class="btn-ghost small" data-promote-mod="' + mid + '" type="button">ناظر</button>';
            btns += '<button class="btn-ghost small danger" data-ban-member="' + mid + '" type="button">بن</button>';
        }

        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--bd);gap:10px;flex-wrap:wrap;">' +
            '<div style="display:flex;align-items:center;gap:10px;min-width:0;">' +
                '<div class="user-avatar" style="width:32px;height:32px;font-size:12px;">' +
                    (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                '<div style="min-width:0;"><strong style="font-size:13px;">' + escapeHtml(u.displayName) + '</strong> ' + roleLabel +
                    '<div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@' + escapeHtml(u.username) + '</div></div>' +
            '</div>' +
            '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + btns + '</div>' +
        '</div>';
    }).join('');

    let requestsHtml = '';
    if ((g.joinRequests || []).length) {
        requestsHtml = '<h4 style="font-size:14px;font-weight:800;margin:16px 0 10px;">درخواست‌ها</h4>' +
            g.joinRequests.map(mid => {
                const u = users.find(x => x.id === mid);
                if (!u) return '';
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;">' +
                    '<strong>' + escapeHtml(u.displayName) + '</strong>' +
                    '<div style="display:flex;gap:4px;">' +
                        '<button class="btn-primary small" data-accept-join="' + mid + '" type="button">قبول</button>' +
                        '<button class="btn-ghost small" data-reject-join="' + mid + '" type="button">رد</button>' +
                    '</div></div>';
            }).join('');
    }

    let siteAdminControls = '';
    if (isSiteAdmin) {
        siteAdminControls = '<div style="padding:14px;border-radius:14px;background:rgba(220,38,38,.06);border:1px solid rgba(220,38,38,.2);margin-bottom:14px;">' +
            '<h4 style="font-size:13px;font-weight:800;margin-bottom:10px;color:var(--bad);">کنترل مدیر سایت</h4>' +
            '<button class="btn-ghost small danger full" id="deleteGroupBtn" type="button">حذف کامل گروه</button></div>';
    }

    box.innerHTML = siteAdminControls +
        '<div style="text-align:center;margin-bottom:16px;">' +
            '<div class="group-page-avatar" style="margin:0 auto 10px;">' +
                (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0].toUpperCase()) + '</div>' +
            '<button class="btn-ghost small" id="changeGroupAvatar" type="button">تغییر آواتار</button>' +
            '<input type="file" id="groupAvatarFile" accept="image/*" hidden>' +
        '</div>' +
        '<div class="form-group" style="margin-bottom:14px;"><label>اسم گروه</label><input type="text" id="gName" value="' + escapeHtml(g.name) + '"></div>' +
        '<div class="form-group" style="margin-bottom:14px;"><label>توضیحات</label><textarea id="gDesc">' + escapeHtml(g.description || '') + '</textarea></div>' +
        '<button class="btn-primary full" id="gSave" type="button" style="margin-bottom:20px;">ذخیره تغییرات</button>' +
        '<h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">اعضا (' + faNum((g.members || []).length) + ')</h4>' +
        '<div style="max-height:300px;overflow-y:auto;">' + membersHtml + '</div>' + requestsHtml;

    openModal('groupSettingsOverlay');

    const changeAv = $('#changeGroupAvatar');
    const fileInp = $('#groupAvatarFile');
    if (changeAv && fileInp) {
        changeAv.addEventListener('click', () => fileInp.click());
        fileInp.addEventListener('change', async e => {
            try {
                const b64 = await fileToBase64(e.target.files[0]);
                const gs = DB.getGroups();
                const gg = gs.find(x => x.id === groupId);
                if (gg) { gg.avatar = b64; DB.setGroups(gs); }
                closeModal('groupSettingsOverlay');
                renderGroupPage(groupId);
                toast('آواتار تغییر کرد');
            } catch (err) { toast(err); }
        });
    }

    const saveBtn = $('#gSave');
    if (saveBtn) saveBtn.addEventListener('click', () => {
        const newName = $('#gName').value.trim();
        if (!newName) return;
        const gs = DB.getGroups();
        const gg = gs.find(x => x.id === groupId);
        if (!gg) return;
        const oldName = gg.name;
        gg.name = newName;
        gg.description = $('#gDesc').value.trim();
        if (oldName !== newName) {
            gg.messages = gg.messages || [];
            gg.messages.push({
                id: uid('m_'), userId: 'system', userName: 'سیستم',
                content: 'اسم گروه از «' + escapeHtml(oldName) + '» به «' + escapeHtml(newName) + '» تغییر کرد',
                createdAt: Date.now(), likes: [], dislikes: [], replies: []
            });
        }
        DB.setGroups(gs);
        toast('ذخیره شد');
        closeModal('groupSettingsOverlay');
        renderGroupPage(groupId);
    });

    const delGroup = $('#deleteGroupBtn');
    if (delGroup) delGroup.addEventListener('click', () => {
        if (!confirm('گروه به طور کامل حذف بشه؟')) return;
        DB.setGroups(DB.getGroups().filter(x => x.id !== groupId));
        toast('گروه حذف شد');
        closeModal('groupSettingsOverlay');
        showPage('groups');
    });

    box.addEventListener('click', e => {
        const pa = e.target.closest('[data-promote-admin]');
        const pm = e.target.closest('[data-promote-mod]');
        const ban = e.target.closest('[data-ban-member]');
        const acc = e.target.closest('[data-accept-join]');
        const rej = e.target.closest('[data-reject-join]');

        if (pa) {
            const gs = DB.getGroups();
            const gg = gs.find(x => x.id === groupId);
            gg.admins = gg.admins || [];
            if (gg.admins.indexOf(pa.dataset.promoteAdmin) === -1) gg.admins.push(pa.dataset.promoteAdmin);
            DB.setGroups(gs);
            toast('ادمین شد');
            closeModal('groupSettingsOverlay');
            openGroupSettings(groupId);
        }
        if (pm) {
            const gs = DB.getGroups();
            const gg = gs.find(x => x.id === groupId);
            gg.mods = gg.mods || [];
            if (gg.mods.indexOf(pm.dataset.promoteMod) === -1) gg.mods.push(pm.dataset.promoteMod);
            DB.setGroups(gs);
            toast('ناظر شد');
            closeModal('groupSettingsOverlay');
            openGroupSettings(groupId);
        }
        if (ban) {
            if (!confirm('بن بشه؟')) return;
            const gs = DB.getGroups();
            const gg = gs.find(x => x.id === groupId);
            gg.banned = gg.banned || [];
            if (gg.banned.indexOf(ban.dataset.banMember) === -1) gg.banned.push(ban.dataset.banMember);
            gg.members = (gg.members || []).filter(id => id !== ban.dataset.banMember);

            const bannedU = getUserById(ban.dataset.banMember);
            gg.messages = gg.messages || [];
            gg.messages.push({
                id: uid('m_'), userId: 'system', userName: 'سیستم',
                content: '«' + escapeHtml(bannedU ? bannedU.displayName : 'کاربر') + '» توسط «' + escapeHtml(State.user.displayName) + '» بن شد',
                createdAt: Date.now(), likes: [], dislikes: [], replies: []
            });
            DB.setGroups(gs);
            toast('بن شد');
            closeModal('groupSettingsOverlay');
            openGroupSettings(groupId);
        }
        if (acc) {
            const gs = DB.getGroups();
            const gg = gs.find(x => x.id === groupId);
            gg.joinRequests = (gg.joinRequests || []).filter(id => id !== acc.dataset.acceptJoin);
            gg.members = gg.members || [];
            if (gg.members.indexOf(acc.dataset.acceptJoin) === -1) gg.members.push(acc.dataset.acceptJoin);
            DB.setGroups(gs);
            toast('قبول شد');
            closeModal('groupSettingsOverlay');
            openGroupSettings(groupId);
        }
        if (rej) {
            const gs = DB.getGroups();
            const gg = gs.find(x => x.id === groupId);
            gg.joinRequests = (gg.joinRequests || []).filter(id => id !== rej.dataset.rejectJoin);
            DB.setGroups(gs);
            closeModal('groupSettingsOverlay');
            openGroupSettings(groupId);
        }
    });
}

/* ═══════ Users Page ═══════ */
function renderUsersPage() {
    const grid = $('#usersGrid');
    if (!grid) return;
    const users = DB.getUsers();
    grid.innerHTML = '';
    users.forEach(u => {
        if (State.user && hasBlockedMe(State.user.id, u.id)) return;
        const card = document.createElement('div');
        card.className = 'user-card';
        const coverHtml = u.cover ? '<div class="user-card-cover"><img src="' + u.cover + '"></div>' : '<div class="user-card-cover"></div>';
        card.innerHTML = coverHtml +
            '<div class="user-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0].toUpperCase()) + '</div>' +
            '<h3>' + escapeHtml(u.displayName) + badgesHtml(u) + '</h3>' +
            '<p>@' + escapeHtml(u.username) + '</p>';
        card.addEventListener('click', () => showPage('profile', u.id));
        grid.appendChild(card);
    });
}

/* ═══════ Profile Page ═══════ */
function renderProfilePage(userId) {
    const box = $('#userProfileContent');
    if (!box) return;
    const u = getUserById(userId);
    if (!u) { box.innerHTML = '<div class="empty-state"><h3>کاربر پیدا نشد</h3></div>'; return; }

    if (State.user && State.user.id !== userId && hasBlockedMe(State.user.id, userId)) {
        box.innerHTML = '<div class="profile-blocked-message"><h3>کاربر بلاکت کرده</h3><p>نمی‌تونی پروفایلش رو ببینی</p></div>';
        return;
    }

    const isMe = State.user && State.user.id === userId;
    const isFriend = State.user && (State.user.friends || []).indexOf(userId) > -1;
    const hasPending = State.user && (State.user.friendRequests || []).indexOf(userId) > -1;
    const iBlocked = State.user && isBlocked(State.user.id, userId);

    const coverHtml = u.cover ? '<div class="profile-cover"><img src="' + u.cover + '"></div>' : '<div class="profile-cover"></div>';

    let actionsHtml = '';
    if (!isMe && State.user) {
        let friendBtn = '';
        if (isFriend) friendBtn = '<button class="btn-ghost small" data-action="unfriend" type="button">لغو دوستی</button>';
        else if (hasPending) friendBtn = '<button class="btn-ghost small" disabled type="button">درخواست ارسال شد</button>';
        else friendBtn = '<button class="btn-primary small" data-action="add-friend" type="button">درخواست دوستی</button>';

        const blockBtn = iBlocked
            ? '<button class="btn-ghost small" data-action="unblock" type="button">رفع بلاک</button>'
            : '<button class="btn-ghost small danger" data-action="block" type="button">بلاک کردن</button>';

        actionsHtml = '<div class="profile-actions">' + friendBtn +
            '<button class="btn-ghost small" data-action="public-msg" type="button">پیام عمومی</button>' +
            '<button class="btn-ghost small" data-action="private-msg" type="button">پیام خصوصی</button>' +
            blockBtn + '</div>';
    } else if (isMe) {
        actionsHtml = '<div class="profile-actions">' +
            '<button class="btn-primary small" id="editMyProfileBtn" type="button">ویرایش پروفایل</button></div>';
    }

    const posts = DB.getPosts().filter(p => p.authorId === userId);
    const commentsCount = DB.getPosts().reduce((sum, p) =>
        sum + (p.comments || []).filter(c => c.userId === userId).length, 0);

    const platformLabel = {
        ps5: 'PlayStation 5', xbox: 'Xbox', switch: 'Nintendo Switch', pc: 'PC', mobile: 'موبایل'
    }[u.platform] || 'PC';

    box.innerHTML = coverHtml +
        '<div class="profile-header">' +
            '<div class="profile-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0].toUpperCase()) + '</div>' +
            '<div class="profile-info">' +
                '<h1>' + escapeHtml(u.displayName) + badgesHtml(u) + '</h1>' +
                '<div class="username">@' + escapeHtml(u.username) + '</div>' +
                (u.title ? '<div class="title">' + escapeHtml(u.title) + '</div>' : '') +
            '</div>' + actionsHtml +
        '</div>' +
        '<div class="profile-stats">' +
            '<div class="profile-stat"><strong>' + faNum(u.xp || 0) + '</strong><span>امتیاز</span></div>' +
            '<div class="profile-stat"><strong>' + faNum(posts.length) + '</strong><span>پست</span></div>' +
            '<div class="profile-stat"><strong>' + faNum(commentsCount) + '</strong><span>نظر</span></div>' +
            '<div class="profile-stat"><strong>' + faNum((u.friends || []).length) + '</strong><span>دوست</span></div>' +
        '</div>' +
        (u.bio ? '<div class="profile-bio"><h3>درباره من</h3><p>' + escapeHtml(u.bio) + '</p></div>' : '') +
        '<div class="profile-bio"><h3>اطلاعات</h3><div class="profile-details-grid">' +
            '<div class="profile-detail-item"><div class="label">پلتفرم</div><div class="value">' + platformLabel + '</div></div>' +
            (u.birthday ? '<div class="profile-detail-item"><div class="label">تاریخ تولد</div><div class="value">' + escapeHtml(u.birthday) + '</div></div>' : '') +
            (u.website ? '<div class="profile-detail-item"><div class="label">وبسایت</div><div class="value" style="direction:ltr;">' + escapeHtml(u.website) + '</div></div>' : '') +
            (u.favGames ? '<div class="profile-detail-item"><div class="label">بازی‌های مورد علاقه</div><div class="value">' + escapeHtml(u.favGames) + '</div></div>' : '') +
            (u.favMovies ? '<div class="profile-detail-item"><div class="label">فیلم‌های مورد علاقه</div><div class="value">' + escapeHtml(u.favMovies) + '</div></div>' : '') +
            (u.instagram ? '<div class="profile-detail-item"><div class="label">اینستاگرام</div><div class="value" style="direction:ltr;">' + escapeHtml(u.instagram) + '</div></div>' : '') +
            (u.telegram ? '<div class="profile-detail-item"><div class="label">تلگرام</div><div class="value" style="direction:ltr;">' + escapeHtml(u.telegram) + '</div></div>' : '') +
            (u.discord ? '<div class="profile-detail-item"><div class="label">دیسکورد</div><div class="value" style="direction:ltr;">' + escapeHtml(u.discord) + '</div></div>' : '') +
        '</div></div>';

    box.querySelectorAll('[data-action]').forEach(btn => {
        btn.addEventListener('click', () => {
            const act = btn.dataset.action;
            if (act === 'add-friend') sendFriendRequest(userId);
            if (act === 'unfriend') { unfriend(userId); renderProfilePage(userId); }
            if (act === 'block') { if (confirm('بلاک بشه؟')) { blockUser(userId); renderProfilePage(userId); } }
            if (act === 'unblock') { unblockUser(userId); renderProfilePage(userId); }
            if (act === 'private-msg') { const t = prompt('پیام خصوصی:'); if (t) sendDirectMessage(userId, t); }
            if (act === 'public-msg') toast('به زودی');
        });
    });

    const editMe = $('#editMyProfileBtn');
    if (editMe) editMe.addEventListener('click', () => openUserPanel('profile'));
}

function unfriend(userId) {
    if (!State.user) return;
    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    const other = users.find(u => u.id === userId);
    if (!me || !other) return;
    me.friends = (me.friends || []).filter(id => id !== userId);
    other.friends = (other.friends || []).filter(id => id !== me.id);
    DB.setUsers(users);
    State.user = me;
    updateBadges();
    toast('لغو دوستی شد');
}

function sendFriendRequest(targetId) {
    if (!State.user) { toast('اول وارد شو'); return; }
    if (targetId === State.user.id) return;

    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    const target = users.find(u => u.id === targetId);
    if (!me || !target) return;

    if ((me.friends || []).indexOf(targetId) > -1) { toast('قبلا دوستته'); return; }
    if ((target.friendRequests || []).indexOf(me.id) > -1) { toast('قبلا درخواست دادی'); return; }

    target.friendRequests = target.friendRequests || [];
    target.friendRequests.push(me.id);
    DB.setUsers(users);
    State.user = me;

    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'), userId: targetId, type: 'friend_request',
        text: me.displayName + ' بهت درخواست دوستی داد', ts: Date.now(), read: false
    });
    DB.setNotifs(notifs);
    toast('درخواست فرستاده شد');
}

function sendDirectMessage(toId, text) {
    if (!State.user) return;
    const messages = DB.getMessages();
    messages.push({ id: uid('m_'), from: State.user.id, to: toId, text, ts: Date.now(), read: false });
    DB.setMessages(messages);
    const notifs = DB.getNotifs();
    notifs.push({
        id: uid('n_'), userId: toId, type: 'message',
        text: State.user.displayName + ' بهت پیام داد', ts: Date.now(), read: false
    });
    DB.setNotifs(notifs);
    toast('پیام فرستاده شد');
}

/* ═══════ Activity Page ═══════ */
function renderActivityPage() {
    const list = $('#activityList');
    if (!list) return;
    const activities = DB.getActivity().slice(-50).reverse();
    if (!activities.length) { list.innerHTML = '<div class="empty-state"><h3>هنوز فعالیتی نیست</h3></div>'; return; }

    list.innerHTML = '';
    const icons = { post: 'پ', comment: 'ن', chat: 'چ', like: 'ل', friend: 'د', group: 'گ' };
    activities.forEach(a => {
        const el = document.createElement('div');
        el.className = 'activity-item';
        el.innerHTML = '<div class="activity-icon">' + (icons[a.type] || '?') + '</div>' +
            '<div class="activity-body"><p>' + escapeHtml(a.text) + '</p><small>' + timeAgo(a.ts) + '</small></div>';
        list.appendChild(el);
    });
}

function addActivity(type, text) {
    const a = DB.getActivity();
    a.push({ id: uid('a_'), type, text, ts: Date.now() });
    if (a.length > 200) a.splice(0, a.length - 200);
    DB.setActivity(a);
}

/* ═══════ User Panel ═══════ */
function openUserPanel(tab) {
    if (!State.user) { openModal('authOverlay'); return; }
    const panel = $('#userPanel');
    if (!panel) return;
    const defaultTab = tab || 'activity';
    $$('.up-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === defaultTab));
    renderUserPanelBody(defaultTab);
    panel.classList.add('on');
    document.body.style.overflow = 'hidden';
}

function closeUserPanel() {
    const panel = $('#userPanel');
    if (panel) panel.classList.remove('on');
    document.body.style.overflow = '';
}

function renderUserPanelBody(tab) {
    const body = $('#userPanelBody');
    if (!body || !State.user) return;

    if (tab === 'activity') body.innerHTML = renderActivityTab();
    else if (tab === 'profile') body.innerHTML = renderProfileTab();
    else if (tab === 'notifications') body.innerHTML = renderNotifsTab();
    else if (tab === 'messages') body.innerHTML = renderMessagesTab();
    else if (tab === 'friends') body.innerHTML = renderFriendsTab();
    else if (tab === 'groups') body.innerHTML = renderGroupsTab();
    else if (tab === 'blocked') body.innerHTML = renderBlockedTab();

    initUserPanelEvents(tab);
}

function renderActivityTab() {
    const u = State.user;
    const posts = DB.getPosts().filter(p => p.authorId === u.id);
    let cc = 0;
    DB.getPosts().forEach(p => (p.comments || []).forEach(c => { if (c.userId === u.id) cc++; }));

    let roleLabel = 'کاربر عادی';
    if (u.role === 'admin') roleLabel = 'مدیر سایت';
    else if (u.role === 'editor') roleLabel = 'سردبیر';
    else if (u.role === 'author') roleLabel = 'نویسنده';

    return '<div class="up-content active">' +
        '<div class="panel-stats-grid">' +
            '<div class="panel-stat-box"><strong>' + faNum(u.xp || 0) + '</strong><span>امتیاز</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(u.level || 1) + '</strong><span>سطح</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(posts.length) + '</strong><span>پست</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(cc) + '</strong><span>نظر</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum((u.friends || []).length) + '</strong><span>دوست</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum((u.groups || []).length) + '</strong><span>گروه</span></div>' +
        '</div>' +
        '<div style="padding:14px;border-radius:14px;background:var(--field);border:1px solid var(--bd);">' +
            '<div style="font-size:12px;color:var(--tx-mute);margin-bottom:6px;">وضعیت حساب</div>' +
            '<div style="font-size:14px;font-weight:700;">' + roleLabel + '</div>' +
        '</div>' +
        '<button class="btn-ghost full" id="logoutBtn" type="button" style="margin-top:16px;color:var(--bad);border-color:var(--bad);">خروج از حساب</button>' +
    '</div>';
}

function renderProfileTab() {
    const u = State.user;
    const initial = (u.displayName || 'U')[0].toUpperCase();

    return '<div class="up-content active"><div class="profile-form">' +
        '<div class="profile-cover-section">' +
            '<div class="profile-cover-preview" id="coverPreview">' + (u.cover ? '<img src="' + u.cover + '">' : '') + '</div>' +
            '<button class="btn-ghost small" id="changeCoverBtn" type="button">تغییر کاور</button>' +
            '<input type="file" id="coverFile" accept="image/*" hidden>' +
        '</div>' +
        '<div class="profile-avatar-section">' +
            '<div class="user-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : initial) + '</div>' +
            '<button class="btn-ghost small" id="changeAvatarBtn" type="button">تغییر آواتار</button>' +
            '<input type="file" id="avatarFile" accept="image/*" hidden>' +
        '</div>' +
        '<div class="form-group"><label>لقب</label><input type="text" id="pTitle" value="' + escapeHtml(u.title || '') + '"></div>' +
        '<div class="form-row">' +
            '<div class="form-group"><label>نام</label><input type="text" id="pFirstName" value="' + escapeHtml(u.firstName || '') + '"></div>' +
            '<div class="form-group"><label>نام خانوادگی</label><input type="text" id="pLastName" value="' + escapeHtml(u.lastName || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>نام نمایشی</label><input type="text" id="pDisplayName" value="' + escapeHtml(u.displayName) + '"></div>' +
        '<div class="form-group"><label>تاریخ تولد</label><input type="text" id="pBirthday" value="' + escapeHtml(u.birthday || '') + '"></div>' +
        '<div class="form-group"><label>پلتفرم</label><select id="pPlatform">' +
            '<option value="ps5"' + (u.platform === 'ps5' ? ' selected' : '') + '>PlayStation 5</option>' +
            '<option value="xbox"' + (u.platform === 'xbox' ? ' selected' : '') + '>Xbox</option>' +
            '<option value="switch"' + (u.platform === 'switch' ? ' selected' : '') + '>Nintendo Switch</option>' +
            '<option value="pc"' + (u.platform === 'pc' ? ' selected' : '') + '>PC</option>' +
            '<option value="mobile"' + (u.platform === 'mobile' ? ' selected' : '') + '>موبایل</option>' +
        '</select></div>' +
        '<div class="form-group"><label>وبسایت</label><input type="text" id="pWebsite" value="' + escapeHtml(u.website || '') + '" dir="ltr"></div>' +
        '<div class="form-group"><label>بیوگرافی</label><textarea id="pBio">' + escapeHtml(u.bio || '') + '</textarea></div>' +
        '<div class="form-group"><label>بازی‌های مورد علاقه</label><input type="text" id="pFavGames" value="' + escapeHtml(u.favGames || '') + '"></div>' +
        '<div class="form-group"><label>فیلم‌های مورد علاقه</label><input type="text" id="pFavMovies" value="' + escapeHtml(u.favMovies || '') + '"></div>' +
        '<div class="form-group"><label>اینستاگرام</label><input type="text" id="pInstagram" value="' + escapeHtml(u.instagram || '') + '" dir="ltr"></div>' +
        '<div class="form-group"><label>تلگرام</label><input type="text" id="pTelegram" value="' + escapeHtml(u.telegram || '') + '" dir="ltr"></div>' +
        '<div class="form-group"><label>دیسکورد</label><input type="text" id="pDiscord" value="' + escapeHtml(u.discord || '') + '" dir="ltr"></div>' +
        '<button class="btn-primary full" id="saveProfileBtn" type="button">ذخیره پروفایل</button>' +
    '</div></div>';
}

function renderNotifsTab() {
    const notifs = DB.getNotifs().filter(n => n.userId === State.user.id).reverse();
    const unread = notifs.filter(n => !n.read);
    if (!notifs.length) return '<div class="empty-state"><h3>اعلانی نداری</h3></div>';

    const icons = { comment: 'ن', friend_request: 'د', message: 'پ', group_request: 'گ', pending_comment: 'ت' };
    let html = '<div class="up-content active">';
    if (unread.length) {
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
            '<span style="font-size:12px;font-weight:700;color:var(--tx-mute);">' + faNum(unread.length) + ' خوانده‌نشده</span>' +
            '<button class="btn-ghost small" id="markAllRead" type="button">خواندن همه</button></div>';
    }
    notifs.forEach(n => {
        html += '<div class="notif-item ' + (n.read ? '' : 'unread') + '" data-notif-id="' + n.id + '" ' +
            (n.link ? 'data-notif-link="' + n.link + '"' : '') + '>' +
            '<div class="notif-icon">' + (icons[n.type] || '؟') + '</div>' +
            '<div class="notif-body"><p>' + escapeHtml(n.text) + '</p><small>' + timeAgo(n.ts) + '</small></div></div>';
    });
    html += '</div>';
    return html;
}

function renderMessagesTab() {
    const msgs = DB.getMessages().filter(m => m.to === State.user.id || m.from === State.user.id).reverse();
    if (!msgs.length) return '<div class="empty-state"><h3>پیامی نداری</h3></div>';

    let html = '<div class="up-content active">';
    msgs.forEach(m => {
        const isMine = m.from === State.user.id;
        const otherId = isMine ? m.to : m.from;
        const other = getUserById(otherId);
        html += '<div class="notif-item"><div class="user-avatar" style="width:36px;height:36px;">' +
            (other && other.avatar ? '<img src="' + other.avatar + '">' : (other ? other.displayName[0] : 'U')) + '</div>' +
            '<div class="notif-body"><p><strong>' + (isMine ? 'شما' : escapeHtml(other ? other.displayName : 'کاربر')) + ':</strong> ' + escapeHtml(m.text) + '</p>' +
            '<small>' + timeAgo(m.ts) + '</small></div></div>';
    });
    html += '</div>';
    return html;
}

function renderFriendsTab() {
    const u = State.user;
    const friends = u.friends || [];
    const requests = u.friendRequests || [];
    let html = '<div class="up-content active">';

    if (requests.length) {
        html += '<h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">درخواست‌ها (' + faNum(requests.length) + ')</h4>';
        const users = DB.getUsers();
        requests.forEach(rid => {
            const r = users.find(x => x.id === rid);
            if (!r) return;
            html += '<div class="notif-item"><div class="user-avatar" style="width:36px;height:36px;">' +
                (r.avatar ? '<img src="' + r.avatar + '">' : r.displayName[0]) + '</div>' +
                '<div class="notif-body"><p><strong>' + escapeHtml(r.displayName) + '</strong> @' + escapeHtml(r.username) + '</p>' +
                '<div style="display:flex;gap:6px;margin-top:6px;">' +
                    '<button class="btn-primary small" data-accept-friend="' + rid + '" type="button">قبول</button>' +
                    '<button class="btn-ghost small" data-reject-friend="' + rid + '" type="button">رد</button>' +
                '</div></div></div>';
        });
    }

    html += '<h4 style="font-size:14px;font-weight:800;margin:16px 0 10px;">دوستان (' + faNum(friends.length) + ')</h4>';
    if (!friends.length) html += '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز دوستی نداری</p>';
    else {
        const users = DB.getUsers();
        friends.forEach(fid => {
            const f = users.find(x => x.id === fid);
            if (!f) return;
            html += '<div class="notif-item"><div class="user-avatar" style="width:36px;height:36px;">' +
                (f.avatar ? '<img src="' + f.avatar + '">' : f.displayName[0]) + '</div>' +
                '<div class="notif-body"><p><strong>' + escapeHtml(f.displayName) + '</strong></p>' +
                '<small>@' + escapeHtml(f.username) + '</small></div>' +
                '<button class="btn-ghost small" data-chat-friend="' + fid + '" type="button">پیام</button></div>';
        });
    }
    html += '</div>';
    return html;
}

function renderGroupsTab() {
    const u = State.user;
    const groups = DB.getGroups().filter(g => (u.groups || []).indexOf(g.id) > -1);
    if (!groups.length) return '<div class="empty-state"><h3>توی هیچ گروهی نیستی</h3></div>';
    let html = '<div class="up-content active">';
    groups.forEach(g => {
        html += '<div class="notif-item" data-group-link="' + g.id + '" style="cursor:pointer;">' +
            '<div class="user-avatar" style="width:36px;height:36px;font-size:14px;">' +
            (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0]) + '</div>' +
            '<div class="notif-body"><p><strong>' + escapeHtml(g.name) + '</strong></p>' +
            '<small>' + faNum((g.members || []).length) + ' عضو</small></div></div>';
    });
    html += '</div>';
    return html;
}

function renderBlockedTab() {
    const b = DB.getBlocks();
    const myBlocked = b[State.user.id] || [];
    if (!myBlocked.length) return '<div class="empty-state"><h3>کسی رو بلاک نکردی</h3></div>';
    const users = DB.getUsers();
    let html = '<div class="up-content active">';
    myBlocked.forEach(bid => {
        const u = users.find(x => x.id === bid);
        if (!u) return;
        html += '<div class="notif-item"><div class="user-avatar" style="width:36px;height:36px;">' +
            (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
            '<div class="notif-body"><p><strong>' + escapeHtml(u.displayName) + '</strong></p>' +
            '<small>@' + escapeHtml(u.username) + '</small></div>' +
            '<button class="btn-ghost small" data-unblock-user="' + bid + '" type="button">رفع بلاک</button></div>';
    });
    html += '</div>';
    return html;
}

function initUserPanelEvents(tab) {
    if (tab === 'activity') {
        const b = $('#logoutBtn');
        if (b) b.addEventListener('click', logoutUser);
    }

    if (tab === 'profile') {
        const chAv = $('#changeAvatarBtn');
        const avInp = $('#avatarFile');
        if (chAv && avInp) {
            chAv.addEventListener('click', () => avInp.click());
            avInp.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file) openCrop(file, 'avatar-user', State.user.id);
            });
        }

        const chCv = $('#changeCoverBtn');
        const cvInp = $('#coverFile');
        if (chCv && cvInp) {
            chCv.addEventListener('click', () => cvInp.click());
            cvInp.addEventListener('change', e => {
                const file = e.target.files[0];
                if (file) openCrop(file, 'cover-user', State.user.id);
            });
        }

        const sv = $('#saveProfileBtn');
        if (sv) sv.addEventListener('click', () => {
            const users = DB.getUsers();
            const me = users.find(u => u.id === State.user.id);
            if (!me) return;
            me.title = $('#pTitle').value.trim();
            me.firstName = $('#pFirstName').value.trim();
            me.lastName = $('#pLastName').value.trim();
            me.displayName = $('#pDisplayName').value.trim() || me.displayName;
            me.birthday = $('#pBirthday').value.trim();
            me.platform = $('#pPlatform').value;
            me.website = $('#pWebsite').value.trim();
            me.bio = $('#pBio').value.trim();
            me.favGames = $('#pFavGames').value.trim();
            me.favMovies = $('#pFavMovies').value.trim();
            me.instagram = $('#pInstagram').value.trim();
            me.telegram = $('#pTelegram').value.trim();
            me.discord = $('#pDiscord').value.trim();
            DB.setUsers(users);
            State.user = me;
            updateAuthUI();
            toast('ذخیره شد');
        });
    }

    if (tab === 'notifications') {
        const mar = $('#markAllRead');
        if (mar) mar.addEventListener('click', () => {
            const notifs = DB.getNotifs();
            notifs.forEach(n => { if (n.userId === State.user.id) n.read = true; });
            DB.setNotifs(notifs);
            updateBadges();
            renderUserPanelBody('notifications');
        });

        $$('[data-notif-id]').forEach(el => {
            el.addEventListener('click', () => {
                const nid = el.dataset.notifId;
                const notifs = DB.getNotifs();
                const n = notifs.find(x => x.id === nid);
                if (n) n.read = true;
                DB.setNotifs(notifs);
                updateBadges();
                const link = el.dataset.notifLink;
                if (link) {
                    const parts = link.split(':');
                    if (parts[0] === 'post') { closeUserPanel(); showPage('post', parts[1]); }
                    else if (parts[0] === 'group') { closeUserPanel(); showPage('group', parts[1]); }
                } else renderUserPanelBody('notifications');
            });
        });
    }

    if (tab === 'friends') {
        $$('[data-accept-friend]').forEach(b => b.addEventListener('click', () => acceptFriend(b.dataset.acceptFriend)));
        $$('[data-reject-friend]').forEach(b => b.addEventListener('click', () => rejectFriend(b.dataset.rejectFriend)));
        $$('[data-chat-friend]').forEach(b => b.addEventListener('click', () => {
            const t = prompt('پیام:');
            if (t) sendDirectMessage(b.dataset.chatFriend, t);
        }));
    }

    if (tab === 'groups') {
        $$('[data-group-link]').forEach(el => el.addEventListener('click', () => {
            closeUserPanel();
            showPage('group', el.dataset.groupLink);
        }));
    }

    if (tab === 'blocked') {
        $$('[data-unblock-user]').forEach(b => b.addEventListener('click', () => {
            unblockUser(b.dataset.unblockUser);
            renderUserPanelBody('blocked');
        }));
    }
}

function acceptFriend(fromId) {
    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    const other = users.find(u => u.id === fromId);
    if (!me || !other) return;
    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    me.friends = me.friends || [];
    other.friends = other.friends || [];
    if (me.friends.indexOf(fromId) === -1) me.friends.push(fromId);
    if (other.friends.indexOf(me.id) === -1) other.friends.push(me.id);
    DB.setUsers(users);
    State.user = me;
    updateBadges();
    renderUserPanelBody('friends');
    toast('حالا دوستید');
}

function rejectFriend(fromId) {
    const users = DB.getUsers();
    const me = users.find(u => u.id === State.user.id);
    if (!me) return;
    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    DB.setUsers(users);
    State.user = me;
    updateBadges();
    renderUserPanelBody('friends');
}

function logoutUser() {
    DB.clearSession();
    State.user = null;
    updateAuthUI();
    closeUserPanel();
    toast('خارج شدی');
}

/* ═══════ Crop ═══════ */
function openCrop(file, mode, targetId) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            State.cropMode = mode;
            State.cropTarget = targetId;
            State.cropImg = img;
            State.cropZoom = 1;
            State.cropRotate = 0;
            $('#cropZoom').value = 100;
            $('#cropRotate').value = 0;
            drawCropCanvas();
            openModal('cropOverlay');
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function drawCropCanvas() {
    const canvas = $('#cropCanvas');
    if (!canvas || !State.cropImg) return;
    const ctx = canvas.getContext('2d');
    const size = 300;
    canvas.width = size;
    canvas.height = size;

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);

    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(State.cropRotate * Math.PI / 180);
    ctx.scale(State.cropZoom, State.cropZoom);

    const scale = Math.min(size / State.cropImg.width, size / State.cropImg.height);
    const w = State.cropImg.width * scale;
    const h = State.cropImg.height * scale;
    ctx.drawImage(State.cropImg, -w / 2, -h / 2, w, h);
    ctx.restore();
}

function applyCrop() {
    const canvas = $('#cropCanvas');
    if (!canvas) return;

    const isCover = State.cropMode.indexOf('cover') > -1;
    const out = document.createElement('canvas');
    out.width = isCover ? 800 : 400;
    out.height = isCover ? 300 : 400;
    const ctx = out.getContext('2d');

    if (isCover) {
        ctx.drawImage(canvas, 0, 80, 300, 140, 0, 0, 800, 300);
    } else {
        ctx.drawImage(canvas, 0, 0, 400, 400);
    }

    const b64 = out.toDataURL('image/jpeg', 0.85);

    if (State.cropMode === 'avatar-user') {
        const users = DB.getUsers();
        const me = users.find(u => u.id === State.cropTarget);
        if (me) { me.avatar = b64; DB.setUsers(users); State.user = me; }
        updateAuthUI();
        renderUserPanelBody('profile');
    } else if (State.cropMode === 'cover-user') {
        const users = DB.getUsers();
        const me = users.find(u => u.id === State.cropTarget);
        if (me) { me.cover = b64; DB.setUsers(users); State.user = me; }
        updateAuthUI();
        renderUserPanelBody('profile');
    } else if (State.cropMode === 'avatar-group') {
        const groups = DB.getGroups();
        const g = groups.find(x => x.id === State.cropTarget);
        if (g) { g.avatar = b64; DB.setGroups(groups); }
        closeModal('cropOverlay');
        renderGroupPage(State.cropTarget);
    } else if (State.cropMode === 'cover-group') {
        const groups = DB.getGroups();
        const g = groups.find(x => x.id === State.cropTarget);
        if (g) { g.cover = b64; DB.setGroups(groups); }
        closeModal('cropOverlay');
        renderGroupPage(State.cropTarget);
    }
    closeModal('cropOverlay');
    toast('ذخیره شد');
}

/* ═══════ Modals ═══════ */
function openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.hidden = false;
    requestAnimationFrame(() => el.classList.add('on'));
    document.body.style.overflow = 'hidden';
}

function closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('on');
    setTimeout(() => {
        el.hidden = true;
        if (!document.querySelector('.modal-overlay.on') &&
            !document.querySelector('.user-panel.on') &&
            !document.querySelector('.side-modal:not([hidden])')) {
            document.body.style.overflow = '';
        }
    }, 220);
}

function closeAllModals() {
    ['authOverlay', 'newGroupOverlay', 'groupSettingsOverlay', 'searchOverlay', 'cropOverlay'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.hidden) closeModal(id);
    });
    ['adminPanel', 'editorPanel', 'authorPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el && !el.hidden) el.hidden = true;
    });
    closeUserPanel();
    closeDrawer();
}

/* ═══════ Auth ═══════ */
function initAuth() {
    $$('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.authTab;
            $$('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
            const loginForm = $('#loginForm');
            const registerForm = $('#registerForm');
            if (loginForm) { loginForm.classList.toggle('active', target === 'login'); loginForm.hidden = target !== 'login'; }
            if (registerForm) { registerForm.classList.toggle('active', target === 'register'); registerForm.hidden = target !== 'register'; }
        });
    });

    const loginForm = $('#loginForm');
    if (loginForm) loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const username = fd.get('username');
        const password = fd.get('password');
        const users = DB.getUsers();
        const clean = username.toLowerCase().trim();
        const user = users.find(u => u.username === clean);

        if (!user) { toast('کاربری با این نام پیدا نشد'); return; }
        if (user.passHash !== hashPass(password)) { toast('رمز اشتباهه'); return; }

        user.lastSeen = Date.now();
        DB.setUsers(users);
        DB.setSession({ userId: user.id, ts: Date.now() });
        State.user = user;
        updateAuthUI();
        closeModal('authOverlay');
        e.target.reset();
        toast('خوش اومدی ' + user.displayName);
    });

    const registerForm = $('#registerForm');
    if (registerForm) registerForm.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const username = fd.get('username');
        const displayName = fd.get('displayName');
        const password = fd.get('password');
        const platform = fd.get('platform') || 'pc';
        const clean = username.toLowerCase().trim();

        if (!/^[a-z][a-z0-9_]{2,19}$/.test(clean)) { toast('نام کاربری فقط با حروف انگلیسی'); return; }
        const users = DB.getUsers();
        if (users.some(u => u.username === clean)) { toast('این نام کاربری گرفته شده'); return; }
        if (password.length < 6) { toast('رمز باید حداقل ۶ کاراکتر باشه'); return; }

        const user = {
            id: uid('u_'), username: clean,
            displayName: displayName.trim() || clean,
            passHash: hashPass(password), platform,
            avatar: null, cover: null, bio: '', title: '',
            firstName: '', lastName: '', birthday: '', website: '',
            favGames: '', favMovies: '', instagram: '', telegram: '', discord: '',
            role: 'user', tick: null, verified: false, level: 1, xp: 0,
            joinedAt: Date.now(), lastSeen: Date.now(),
            friends: [], friendRequests: [], blocked: [], groups: []
        };

        users.push(user);
        if (users.length === 1) { user.role = 'admin'; user.verified = true; }
        DB.setUsers(users);
        DB.setSession({ userId: user.id, ts: Date.now() });
        State.user = user;
        updateAuthUI();
        closeModal('authOverlay');
        e.target.reset();
        toast('خوش اومدی ' + user.displayName);
    });
}

/* ═══════ Drawer ═══════ */
function openDrawer() {
    const d = $('#drawer');
    if (!d) return;
    d.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    const d = $('#drawer');
    if (!d) return;
    d.hidden = true;
    document.body.style.overflow = '';
}

/* ═══════ Admin Panel ═══════ */
function openAdminPanel() {
    const p = $('#adminPanel');
    if (!p) return;
    p.hidden = false;
    renderAdminTab(State.adminTab);
}

function renderAdminTab(tab) {
    State.adminTab = tab;
    const body = $('#adminBody');
    if (!body) return;

    $$('.sm-tab[data-admin-tab]').forEach(t => t.classList.toggle('active', t.dataset.adminTab === tab));

    const users = DB.getUsers();
    const posts = DB.getPosts();
    const groups = DB.getGroups();
    const pending = DB.getPending();

    if (tab === 'stats') {
        const totalViews = posts.reduce((s, p) => s + (p.views || 0), 0);
        const totalLikes = posts.reduce((s, p) => s + (p.comments || []).reduce((ss, c) => ss + (c.likes || []).length, 0), 0);
        const totalComments = posts.reduce((s, p) => s + (p.comments || []).length, 0);

        body.innerHTML =
            '<div class="admin-stats-grid">' +
                '<div class="admin-stat-card"><strong>' + faNum(users.length) + '</strong><span>کاربران</span></div>' +
                '<div class="admin-stat-card green"><strong>' + faNum(posts.length) + '</strong><span>پست‌ها</span></div>' +
                '<div class="admin-stat-card pink"><strong>' + faNum(totalViews) + '</strong><span>بازدید کل</span></div>' +
                '<div class="admin-stat-card orange"><strong>' + faNum(totalLikes) + '</strong><span>لایک کل</span></div>' +
                '<div class="admin-stat-card"><strong>' + faNum(totalComments) + '</strong><span>کامنت کل</span></div>' +
                '<div class="admin-stat-card green"><strong>' + faNum(groups.length) + '</strong><span>گروه‌ها</span></div>' +
                '<div class="admin-stat-card orange"><strong>' + faNum(pending.length) + '</strong><span>در انتظار تأیید</span></div>' +
                '<div class="admin-stat-card pink"><strong>' + faNum(DB.getActivity().length) + '</strong><span>فعالیت‌ها</span></div>' +
            '</div>';
    }

    else if (tab === 'users') {
        body.innerHTML = users.map(u =>
            '<div class="admin-user-row">' +
                '<div class="admin-user-info">' +
                    '<div class="user-avatar" style="width:36px;height:36px;">' +
                        (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                    '<div><strong style="font-size:13px;">' + escapeHtml(u.displayName) + '</strong>' + badgesHtml(u) +
                        '<div style="font-size:11px;color:var(--tx-mute);">@' + escapeHtml(u.username) + ' · ' + u.role + '</div></div>' +
                '</div>' +
                '<div class="admin-user-actions">' +
                    '<select data-role="' + u.id + '" style="padding:5px 8px;border-radius:6px;background:var(--field);border:1px solid var(--bd);font-size:11px;">' +
                        '<option value="user"' + (u.role === 'user' ? ' selected' : '') + '>کاربر</option>' +
                        '<option value="author"' + (u.role === 'author' ? ' selected' : '') + '>نویسنده</option>' +
                        '<option value="editor"' + (u.role === 'editor' ? ' selected' : '') + '>سردبیر</option>' +
                        '<option value="admin"' + (u.role === 'admin' ? ' selected' : '') + '>مدیر</option>' +
                    '</select>' +
                    '<button class="btn-ghost small" data-tick-blue="' + u.id + '" type="button">آبی</button>' +
                    '<button class="btn-ghost small" data-tick-gold="' + u.id + '" type="button">طلایی</button>' +
                    '<button class="btn-ghost small" data-tick-none="' + u.id + '" type="button">حذف تیک</button>' +
                    '<button class="btn-ghost small danger" data-delete-user="' + u.id + '" type="button">حذف</button>' +
                '</div>' +
            '</div>'
        ).join('');
    }

    else if (tab === 'posts') {
        body.innerHTML = posts.length ? posts.map(p =>
            '<div class="admin-user-row">' +
                '<div class="admin-user-info">' +
                    '<div><strong style="font-size:13px;">' + escapeHtml(p.title) + '</strong>' +
                        '<div style="font-size:11px;color:var(--tx-mute);">' + escapeHtml(p.authorName || '') + ' · ' + timeAgo(p.createdAt) + '</div></div>' +
                '</div>' +
                '<div class="admin-user-actions">' +
                    '<button class="btn-ghost small" data-edit-post="' + p.id + '" type="button">ویرایش</button>' +
                    '<button class="btn-ghost small danger" data-delete-post="' + p.id + '" type="button">حذف</button>' +
                '</div>' +
            '</div>'
        ).join('') : '<div class="empty-state"><h3>پستی نیست</h3></div>';
    }

    else if (tab === 'comments') {
        if (!pending.length) {
            body.innerHTML = '<div class="empty-state"><h3>کامنت در انتظاری نیست</h3></div>';
        } else {
            body.innerHTML = pending.map(item => {
                const u = getUserById(item.comment.userId);
                return '<div class="pending-item">' +
                    '<div class="pending-item-head">' +
                        '<div class="user-avatar" style="width:32px;height:32px;">' +
                            (u && u.avatar ? '<img src="' + u.avatar + '">' : (u ? u.displayName[0] : '؟')) + '</div>' +
                        '<div><strong>' + escapeHtml(u ? u.displayName : 'ناشناس') + '</strong>' +
                            '<div style="font-size:11px;color:var(--tx-mute);">' + timeAgo(item.addedAt) + '</div></div>' +
                    '</div>' +
                    '<div class="pending-item-body">' + item.comment.content + '</div>' +
                    '<div class="pending-actions">' +
                        '<button class="btn-primary small" data-approve-comment="' + item.comment.id + '" type="button">تأیید
