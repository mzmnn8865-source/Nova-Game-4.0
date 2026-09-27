'use strict';

/* ═══════ ابزارها ═══════ */
const $ = (s, c) => (c || document).querySelector(s);
const $$ = (s, c) => Array.from((c || document).querySelectorAll(s));

const store = {
    get(k, fb) { try { const v = localStorage.getItem(k); return v === null ? fb : v; } catch (e) { return fb; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
    json(k, fb) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch (e) { return fb; } }
};

function hashPass(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) { h = ((h << 5) + h) + s.charCodeAt(i); h &= h; }
    return 'h_' + Math.abs(h).toString(36) + '_' + s.length;
}
function faNum(n) { return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function uid(p) { return (p || '') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }
function stripHtml(h) { const d = document.createElement('div'); d.innerHTML = h || ''; return d.textContent || ''; }
function timeAgo(ts) {
    const d = (Date.now() - ts) / 1000;
    if (d < 60) return 'همین الان';
    if (d < 3600) return faNum(Math.floor(d / 60)) + ' دقیقه پیش';
    if (d < 86400) return faNum(Math.floor(d / 3600)) + ' ساعت پیش';
    if (d < 604800) return faNum(Math.floor(d / 86400)) + ' روز پیش';
    try { return new Date(ts).toLocaleDateString('fa-IR'); } catch (e) { return ''; }
}
function parseMentions(t) {
    return t.replace(/@([a-zA-Z][a-zA-Z0-9_]{2,19})/g, (m, u) => '<span class="mention" data-username="' + u.toLowerCase() + '">@' + u + '</span>');
}
function fileToBase64(file) {
    return new Promise((res, rej) => {
        if (file.size > 800 * 1024) { rej('حجم فایل زیاده'); return; }
        const r = new FileReader();
        r.onload = () => res(r.result);
        r.onerror = () => rej('خطا در خواندن');
        r.readAsDataURL(file);
    });
}

let toastTimer;
function toast(msg, d) {
    const el = $('#toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), d || 2200);
}

/* ═══════ دیتابیس ═══════ */
const DB = {
    getUsers() { return store.json('nova.users', []); },
    setUsers(v) { store.set('nova.users', JSON.stringify(v)); },
    getPosts() { return store.json('nova.posts', []); },
    setPosts(v) { store.set('nova.posts', JSON.stringify(v)); },
    getGroups() { return store.json('nova.groups', []); },
    setGroups(v) { store.set('nova.groups', JSON.stringify(v)); },
    getNotifs() { return store.json('nova.notifs', []); },
    setNotifs(v) { store.set('nova.notifs', JSON.stringify(v)); },
    getMessages() { return store.json('nova.messages', []); },
    setMessages(v) { store.set('nova.messages', JSON.stringify(v)); },
    getActivity() { return store.json('nova.activity', []); },
    setActivity(v) { store.set('nova.activity', JSON.stringify(v)); },
    getBlocks() { return store.json('nova.blocks', {}); },
    setBlocks(v) { store.set('nova.blocks', JSON.stringify(v)); },
    getPending() { return store.json('nova.pending', []); },
    setPending(v) { store.set('nova.pending', JSON.stringify(v)); },
    getSession() { return store.json('nova.session', null); },
    setSession(v) { store.set('nova.session', JSON.stringify(v)); },
    clearSession() { store.del('nova.session'); }
};

/* ═══════ State ═══════ */
const S = {
    theme: store.get('nova.theme', 'light'),
    user: null,
    page: 'home',
    pageData: null,
    postFilter: 'all',
    timeFilter: 'day',
    groupFilter: 'all',
    adminTab: 'stats',
    cropMode: null,
    cropTarget: null,
    cropImg: null,
    cropZoom: 1,
    cropRotate: 0,
    editingPostId: null
};

/* ═══════ تم ═══════ */
function applyTheme(theme) {
    let final = theme;
    if (theme === 'auto') {
        const h = new Date().getHours();
        final = (h >= 7 && h < 19) ? 'light' : 'dark';
    }
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle('light', final === 'light');
    document.documentElement.classList.toggle('dark', final === 'dark');
    S.theme = theme;
    store.set('nova.theme', theme);
    const icon = $('#themeIcon');
    if (icon) {
        if (theme === 'light') icon.innerHTML = '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>';
        else if (theme === 'dark') icon.innerHTML = '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>';
        else icon.innerHTML = '<circle cx="12" cy="12" r="9"/><path d="M12 3v18"/>';
    }
}
function flipTheme() {
    const order = ['light', 'dark', 'auto'];
    const idx = order.indexOf(S.theme);
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
    toast({ light: 'حالت روز', dark: 'حالت شب', auto: 'حالت خودکار' }[next]);
}
setInterval(() => { if (S.theme === 'auto') applyTheme('auto'); }, 60000);

/* ═══════ کاربر ═══════ */
function getCurrentUser() {
    const session = DB.getSession();
    if (!session) return null;
    return DB.getUsers().find(u => u.id === session.userId) || null;
}
function getUserById(id) { return DB.getUsers().find(u => u.id === id) || null; }

function badgesHtml(u) {
    if (!u) return '';
    let html = '';
    if (u.role === 'admin') html += '<svg class="badge-icon badge-crown-admin" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg>';
    if (u.role === 'editor') html += '<svg class="badge-icon badge-tick-editor" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 6.5L22 9.5l-5 4.5L18.5 22 12 18l-6.5 4L7 14 2 9.5l7-1z"/></svg>';
    if (u.tick === 'blue') html += '<svg class="badge-icon badge-tick-blue" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 14.5l-4-4L8 11l2.5 2.5L16 8l1.5 1.5-7 7z"/></svg>';
    if (u.tick === 'gold') html += '<svg class="badge-icon badge-tick-gold" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm-1.5 14.5l-4-4L8 11l2.5 2.5L16 8l1.5 1.5-7 7z"/></svg>';
    return html ? '<span class="name-badge">' + html + '</span>' : '';
}

function updateAuthUI() {
    const u = S.user;
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
        if (drawerName) drawerName.innerHTML = esc(u.displayName) + badgesHtml(u);
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
    if (!S.user) return;
    const notifCount = $('#notifCount');
    const msgCount = $('#msgCount');
    const friendCount = $('#friendCount');
    const navDot = $('#navNotifDot');

    const notifs = DB.getNotifs().filter(n => n.userId === S.user.id && !n.read);
    const msgs = DB.getMessages().filter(m => m.to === S.user.id && !m.read);
    const reqs = (S.user.friendRequests || []).length;

    if (notifCount) { notifCount.hidden = notifs.length === 0; notifCount.textContent = faNum(notifs.length); }
    if (msgCount) { msgCount.hidden = msgs.length === 0; msgCount.textContent = faNum(msgs.length); }
    if (friendCount) { friendCount.hidden = reqs === 0; friendCount.textContent = faNum(reqs); }
    if (navDot) navDot.hidden = notifs.length === 0;
}

function logoutUser() {
    DB.clearSession();
    S.user = null;
    updateAuthUI();
    closeUserPanel();
    toast('خارج شدی');
}

/* ═══════ Blocks ═══════ */
function isBlocked(ownerId, targetId) {
    const b = DB.getBlocks();
    return !!(b[ownerId] && b[ownerId].indexOf(targetId) > -1);
}
function hasBlockedMe(meId, otherId) { return isBlocked(otherId, meId); }
function blockUser(tid) {
    if (!S.user || tid === S.user.id) return;
    const b = DB.getBlocks();
    b[S.user.id] = b[S.user.id] || [];
    if (b[S.user.id].indexOf(tid) === -1) b[S.user.id].push(tid);
    DB.setBlocks(b);
    toast('بلاک شد');
}
function unblockUser(tid) {
    if (!S.user) return;
    const b = DB.getBlocks();
    if (b[S.user.id]) b[S.user.id] = b[S.user.id].filter(id => id !== tid);
    DB.setBlocks(b);
    toast('رفع بلاک شد');
}

/* ═══════ Router ═══════ */
function showPage(page, data) {
    $$('.page').forEach(p => p.classList.remove('active'));
    const el = document.getElementById('page-' + page);
    if (el) el.classList.add('active');
    S.page = page;
    S.pageData = data || null;
    window.scrollTo(0, 0);
    const titles = { home: 'نووا گیم', post: 'پست', groups: 'گروه‌ها', group: 'چت', users: 'کاربران', activity: 'فعالیت‌ها', about: 'درباره ما', cinema: 'سینما', games: 'بازی', profile: 'پروفایل' };
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
    if (S.postFilter === 'editor') posts = posts.filter(p => p.editorChoice === true);
    else if (S.postFilter === 'discussed') posts.sort((a, b) => ((b.comments || []).length) - ((a.comments || []).length));
    else if (S.postFilter === 'popular') posts.sort((a, b) => (b.views || 0) - (a.views || 0));
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
    const coverHtml = post.cover ? '<img src="' + post.cover + '" alt="">' : '';
    const pinHtml = post.pinned ? '<span class="post-card-pin">پین</span>' : '';
    card.innerHTML =
        '<div class="post-card-cover" style="' + (post.cover ? '' : 'background:linear-gradient(135deg,var(--accent),var(--accent-2));') + '">' +
            coverHtml + '<span class="post-card-badge">' + catLabel + '</span>' + pinHtml +
        '</div>' +
        '<div class="post-card-body">' +
            '<h3 class="post-card-title">' + esc(post.title) + '</h3>' +
            '<p class="post-card-excerpt">' + esc(post.excerpt || stripHtml(post.content).slice(0, 120)) + '</p>' +
            '<div class="post-card-meta">' +
                '<span>' + timeAgo(post.createdAt) + '</span><span>·</span>' +
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
    const range = ranges[S.timeFilter] || ranges.day;
    posts = posts.filter(p => (now - p.createdAt) < range);
    posts.sort((a, b) => (b.views || 0) - (a.views || 0));
    if (!posts.length) { grid.innerHTML = '<div class="empty-state"><h3>چیزی برای نمایش نیست</h3></div>'; return; }
    grid.innerHTML = '';
    posts.slice(0, 6).forEach(p => grid.appendChild(createPostCard(p)));
}

function renderHomeGroups() {
    const grid = $('#homeGroupsGrid');
    if (!grid) return;
    const groups = DB.getGroups().filter(g => g.type === 'public').slice(0, 3);
    if (!groups.length) { grid.innerHTML = '<div class="empty-state"><h3>هنوز گروهی نیست</h3></div>'; return; }
    grid.innerHTML = '';
    groups.forEach(g => grid.appendChild(createGroupCard(g)));
}

/* ═══════ Post Page ═══════ */
function renderPostPage(postId) {
    const box = $('#postContent');
    if (!box) return;
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) { box.innerHTML = '<div class="empty-state"><h3>پست پیدا نشد</h3></div>'; return; }

    post.views = (post.views || 0) + 1;
    DB.setPosts(posts);

    const author = getUserById(post.authorId);
    const catLabel = { news: 'خبر', review: 'نقد', guide: 'راهنما', cinema: 'سینما', game: 'بازی' }[post.category] || 'خبر';
    const coverHtml = post.cover ? '<div class="post-page-cover"><img src="' + post.cover + '"></div>' : '';
    const editedHtml = post.edited ? '<span class="edited-tag">(ویرایش‌شده)</span>' : '';
    const canEdit = S.user && (S.user.id === post.authorId || S.user.role === 'admin' || S.user.role === 'editor');
    const canDelete = S.user && (S.user.id === post.authorId || S.user.role === 'admin');

    let actionsHtml = '';
    if (canEdit || canDelete) {
        actionsHtml = '<div class="post-page-actions">';
        if (canEdit) actionsHtml += '<button class="btn-ghost small" id="editPostBtn" type="button">ویرایش پست</button>';
        if (canDelete) actionsHtml += '<button class="btn-ghost small danger" id="deletePostBtn" type="button">حذف پست</button>';
        actionsHtml += '</div>';
    }

    const metaCat = catLabel + (post.score ? ' · ' + faNum(post.score) + '/۱۰' : '') + (post.editorChoice ? ' · انتخاب سردبیر' : '');

    let commentFormHtml = '';
    if (S.user) {
        commentFormHtml = '<div class="comment-form">' +
            '<div class="comment-editor" id="commentEditor" contenteditable="true" data-placeholder="نظرت رو بنویس"></div>' +
            '<div class="comment-toolbar">' +
                '<button type="button" data-cmd="bold"><b>B</b></button>' +
                '<button type="button" data-cmd="italic"><i>I</i></button>' +
                '<button type="button" data-cmd="underline"><u>U</u></button>' +
                '<span class="sep"></span>' +
                '<button type="button" id="btnSpoiler">اسپویلر</button>' +
                '<button type="button" id="btnMention">@</button>' +
                '<button type="button" id="btnColorPicker">رنگ</button>' +
                '<button type="button" id="btnRainbow">رقص نور</button>' +
            '</div>' +
            '<div class="color-picker" id="colorPicker" hidden>' +
                '<input type="color" id="customColor">' +
                '<div class="color-dot" style="background:#dc2626" data-color="#dc2626"></div>' +
                '<div class="color-dot" style="background:#ea580c" data-color="#ea580c"></div>' +
                '<div class="color-dot" style="background:#16a34a" data-color="#16a34a"></div>' +
                '<div class="color-dot" style="background:#2563eb" data-color="#2563eb"></div>' +
                '<div class="color-dot" style="background:#7c3aed" data-color="#7c3aed"></div>' +
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

    let comments = post.comments || [];
    if (S.user) comments = comments.filter(c => !isBlocked(S.user.id, c.userId));
    comments = comments.filter(c => c.status !== 'pending' || (S.user && (c.userId === S.user.id || S.user.role === 'admin')));

    const commentsHtml = comments.length
        ? comments.map(c => renderComment(c, post.id, 0)).join('')
        : '<p style="text-align:center;color:var(--tx-mute);padding:20px;font-size:13px;">هنوز نظری نیست. اولین نفر باش</p>';

    box.innerHTML = coverHtml +
        '<div class="post-page-header">' +
            '<span class="post-page-cat">' + metaCat + '</span>' +
            '<h1 class="post-page-title">' + esc(post.title) + '</h1>' +
            '<div class="post-page-meta">' +
                '<div class="author">' +
                    '<div class="user-avatar">' + (post.authorAvatar ? '<img src="' + post.authorAvatar + '">' : ((post.authorName || 'N')[0])) + '</div>' +
                    '<strong>' + esc(post.authorName || 'ناشناس') + '</strong>' + (author ? badgesHtml(author) : '') +
                '</div>' +
                '<span>·</span><span>' + timeAgo(post.createdAt) + ' ' + editedHtml + '</span>' +
                '<span>·</span><span>' + faNum(post.views) + ' بازدید</span>' +
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
        toast('حذف شد');
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
    const userLiked = S.user && likes.indexOf(S.user.id) > -1;
    const userDisliked = S.user && dislikes.indexOf(S.user.id) > -1;

    let reactionsHtml = '';
    if (likes.length || dislikes.length) {
        const users = DB.getUsers();
        let avatars = '';
        likes.slice(0, 5).forEach(lid => {
            const lu = users.find(u => u.id === lid);
            if (lu) {
                const init = (lu.displayName || 'U')[0].toUpperCase();
                avatars += '<div class="reaction-avatar" title="' + esc(lu.displayName) + '">' +
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
    const canEdit = S.user && S.user.id === comment.userId && age < editLimit;
    const canDelete = S.user && (S.user.id === comment.userId || S.user.role === 'admin');

    const pendingBadge = comment.status === 'pending' ? '<span class="comment-pending-badge">در انتظار تأیید</span>' : '';
    const editedTag = comment.edited ? '<span class="edited-tag">(ویرایش‌شده)</span>' : '';

    let repliesHtml = '';
    if (comment.replies && comment.replies.length && level < 5) {
        repliesHtml = '<div class="comment-replies">' + comment.replies.map(r => renderComment(r, postId, level + 1)).join('') + '</div>';
    }

    return '<div class="comment-item ' + (comment.status === 'pending' ? 'pending' : '') + '" data-comment-id="' + comment.id + '">' +
        '<div class="comment-item-header">' +
            '<div class="user-avatar">' + (avatar ? '<img src="' + avatar + '">' : initial) + '</div>' +
            '<div class="user-name">' +
                '<strong>' + esc(name) + (user ? badgesHtml(user) : '') + '</strong>' +
                '<small>@' + esc(user ? user.username : 'user') + '</small>' +
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
        '</div>' + reactionsHtml + repliesHtml +
    '</div>';
}

function findComment(list, id) {
    for (let i = 0; i < list.length; i++) {
        if (list[i].id === id) return list[i];
        if (list[i].replies && list[i].replies.length) {
            const f = findComment(list[i].replies, id);
            if (f) return f;
        }
    }
    return null;
}

function initCommentEditor(postId) {
    const editor = $('#commentEditor');
    if (!editor) {
        const lb = $('#loginToComment');
        if (lb) lb.addEventListener('click', () => openModal('authOverlay'));
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
        document.execCommand('insertHTML', false, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + esc(sel) + '</span>');
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

    $$('#colorPicker .color-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            document.execCommand('foreColor', false, dot.dataset.color);
            editor.focus();
        });
    });

    const bR = $('#btnRainbow');
    if (bR) bR.addEventListener('click', () => {
        const sel = window.getSelection().toString() || 'رقص نور';
        document.execCommand('insertHTML', false, '<span class="rainbow-text">' + esc(sel) + '</span>');
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

    const list = $('#commentList');
    if (list) {
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
}

function addComment(postId, content) {
    if (!S.user) return;
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const u = S.user;
    const needsApproval = !u.tick && u.role !== 'admin' && u.role !== 'editor';

    const comment = {
        id: uid('c_'), userId: u.id, userName: u.displayName, userAvatar: u.avatar,
        content: parseMentions(content), createdAt: Date.now(),
        likes: [], dislikes: [], replies: [],
        status: needsApproval ? 'pending' : 'approved', edited: false
    };

    if (needsApproval) {
        const pending = DB.getPending();
        pending.push({ comment, postId, addedAt: Date.now() });
        DB.setPending(pending);
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
    if (!S.user) { toast('اول وارد شو'); return; }
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = findComment(post.comments || [], commentId);
    if (!comment) return;
    comment.likes = comment.likes || [];
    comment.dislikes = comment.dislikes || [];
    if (type === 'like') {
        comment.dislikes = comment.dislikes.filter(id => id !== S.user.id);
        if (comment.likes.indexOf(S.user.id) > -1) comment.likes = comment.likes.filter(id => id !== S.user.id);
        else comment.likes.push(S.user.id);
    } else {
        comment.likes = comment.likes.filter(id => id !== S.user.id);
        if (comment.dislikes.indexOf(S.user.id) > -1) comment.dislikes = comment.dislikes.filter(id => id !== S.user.id);
        else comment.dislikes.push(S.user.id);
    }
    DB.setPosts(posts);
    renderPostPage(postId);
}

function replyToComment(postId, commentId) {
    const text = prompt('پاسخ:');
    if (!text || !text.trim() || !S.user) return;
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = findComment(post.comments || [], commentId);
    if (!comment) return;
    comment.replies = comment.replies || [];
    comment.replies.push({
        id: uid('c_'), userId: S.user.id, userName: S.user.displayName,
        userAvatar: S.user.avatar, content: esc(text), createdAt: Date.now(),
        likes: [], dislikes: [], replies: [], status: 'approved', edited: false
    });
    DB.setPosts(posts);
    renderPostPage(postId);
}

function editComment(postId, commentId) {
    const posts = DB.getPosts();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const comment = findComment(post.comments || [], commentId);
    if (!comment) return;
    const newText = prompt('متن جدید:', stripHtml(comment.content));
    if (!newText || !newText.trim()) return;
    comment.content = esc(newText);
    comment.edited = true;
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

/* ═══════ Activity ═══════ */
function addActivity(type, text) {
    const a = DB.getActivity();
    a.push({ id: uid('a_'), type, text, ts: Date.now() });
    if (a.length > 200) a.splice(0, a.length - 200);
    DB.setActivity(a);
}

function renderActivityPage() {
    const list = $('#activityList');
    if (!list) return;
    const activities = DB.getActivity().slice(-50).reverse();
    if (!activities.length) { list.innerHTML = '<div class="empty-state"><h3>هنوز فعالیتی نیست</h3></div>'; return; }
    const icons = { post: 'پ', comment: 'ن', chat: 'چ', like: 'ل', friend: 'د', group: 'گ' };
    list.innerHTML = '';
    activities.forEach(a => {
        const el = document.createElement('div');
        el.className = 'activity-item';
        el.innerHTML = '<div class="activity-icon">' + (icons[a.type] || '?') + '</div>' +
            '<div class="activity-body"><p>' + esc(a.text) + '</p><small>' + timeAgo(a.ts) + '</small></div>';
        list.appendChild(el);
    });
}
/* ═══════ Groups ═══════ */
function renderGroupsPage() {
    const grid = $('#groupsGrid');
    if (!grid) return;
    let groups = DB.getGroups();
    if (S.groupFilter === 'public') groups = groups.filter(g => g.type === 'public');
    else if (S.groupFilter === 'private') groups = groups.filter(g => g.type === 'private');
    else if (S.groupFilter === 'mine') {
        if (!S.user) groups = [];
        else groups = groups.filter(g => (S.user.groups || []).indexOf(g.id) > -1);
    }
    if (!groups.length) { grid.innerHTML = '<div class="empty-state"><h3>گروهی نیست</h3></div>'; return; }
    grid.innerHTML = '';
    groups.forEach(g => grid.appendChild(createGroupCard(g)));
}

function createGroupCard(group) {
    const card = document.createElement('div');
    card.className = 'group-card';
    const typeLabel = group.type === 'public' ? 'عمومی' : 'خصوصی';
    let coverStyle = 'background:linear-gradient(135deg,var(--accent),var(--accent-2));';
    if (group.cover) coverStyle = "background:url('" + group.cover + "') center/cover;";
    card.innerHTML = '<div class="group-card-cover" style="' + coverStyle + '">' +
            '<span class="group-card-type ' + group.type + '">' + typeLabel + '</span>' +
        '</div>' +
        '<div class="group-card-body">' +
            '<div class="group-card-avatar">' + (group.avatar ? '<img src="' + group.avatar + '">' : (group.name || 'G')[0].toUpperCase()) + '</div>' +
            '<div class="group-card-info">' +
                '<h3>' + esc(group.name) + '</h3>' +
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

    const u = S.user;
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
            '<span class="team-name">' + esc(owner.displayName) + '</span>' +
            '<svg class="team-role-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5z"/></svg></div>';
    }
    (group.admins || []).forEach(aid => {
        const au = users.find(x => x.id === aid);
        if (!au) return;
        teamHtml += '<div class="team-member admin" data-user-id="' + au.id + '">' +
            '<div class="user-avatar">' + (au.avatar ? '<img src="' + au.avatar + '">' : au.displayName[0]) + '</div>' +
            '<span class="team-name">' + esc(au.displayName) + '</span></div>';
    });
    (group.mods || []).forEach(mid => {
        const mu = users.find(x => x.id === mid);
        if (!mu) return;
        teamHtml += '<div class="team-member mod" data-user-id="' + mu.id + '">' +
            '<div class="user-avatar">' + (mu.avatar ? '<img src="' + mu.avatar + '">' : mu.displayName[0]) + '</div>' +
            '<span class="team-name">' + esc(mu.displayName) + '</span></div>';
    });
    const teamSection = teamHtml ? '<div class="group-team"><span class="group-team-label">تیم مدیریت</span><div class="group-team-list">' + teamHtml + '</div></div>' : '';

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
                '<div class="color-dot" style="background:#dc2626" data-color="#dc2626"></div>' +
                '<div class="color-dot" style="background:#ea580c" data-color="#ea580c"></div>' +
                '<div class="color-dot" style="background:#16a34a" data-color="#16a34a"></div>' +
                '<div class="color-dot" style="background:#2563eb" data-color="#2563eb"></div>' +
                '<div class="color-dot" style="background:#7c3aed" data-color="#7c3aed"></div>' +
            '</div></div>';
    } else {
        inputHtml = '<div class="chat-input-wrap" style="text-align:center;padding:16px;"><p style="font-size:12px;color:var(--tx-mute);">' +
            (isBanned ? 'تو بن شدی، نمی‌تونی پیام بفرستی' : 'عضو نیستی') + '</p></div>';
    }

    box.innerHTML = '<div class="group-page-header">' +
            '<div class="group-page-avatar">' + (group.avatar ? '<img src="' + group.avatar + '">' : (group.name || 'G')[0].toUpperCase()) + '</div>' +
            '<div class="group-page-info"><h1>' + esc(group.name) + '</h1>' +
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

    const userLiked = S.user && (msg.likes || []).indexOf(S.user.id) > -1;
    const userDisliked = S.user && (msg.dislikes || []).indexOf(S.user.id) > -1;
    const imageHtml = msg.image ? '<img src="' + msg.image + '" class="chat-msg-image" onclick="window.open(this.src)">' : '';
    const age = (Date.now() - msg.createdAt) / 1000;
    const canEdit = S.user && S.user.id === msg.userId && age < 600;
    const canDelete = S.user && (
        S.user.id === msg.userId ||
        group.ownerId === S.user.id ||
        (group.admins || []).indexOf(S.user.id) > -1 ||
        (group.mods || []).indexOf(S.user.id) > -1
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
            '<div class="chat-msg-head"><strong>' + esc(name) + '</strong>' + (user ? badgesHtml(user) : '') + roleBadge +
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
    const userLiked = S.user && (reply.likes || []).indexOf(S.user.id) > -1;
    const userDisliked = S.user && (reply.dislikes || []).indexOf(S.user.id) > -1;
    const age = (Date.now() - reply.createdAt) / 1000;
    const canEdit = S.user && S.user.id === reply.userId && age < 600;
    const canDelete = S.user && (
        S.user.id === reply.userId ||
        group.ownerId === S.user.id ||
        (group.admins || []).indexOf(S.user.id) > -1 ||
        (group.mods || []).indexOf(S.user.id) > -1
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
            '<strong>' + esc(name) + '</strong>' + (user ? badgesHtml(user) : '') +
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
            document.execCommand('insertHTML', false, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + esc(sel) + '</span>');
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
            document.execCommand('insertHTML', false, '<span class="rainbow-text">' + esc(sel) + '</span>');
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
    if (!S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    g.messages = g.messages || [];
    g.messages.push({
        id: uid('m_'), userId: S.user.id, userName: S.user.displayName,
        userAvatar: S.user.avatar, content: content ? parseMentions(content) : '',
        image: image || null, createdAt: Date.now(), likes: [], dislikes: [], replies: [], edited: false
    });
    DB.setGroups(groups);
    addActivity('chat', S.user.displayName + ' توی گروه «' + g.name + '» پیام داد');
    renderGroupPage(groupId);
}

function toggleMsgReaction(groupId, msgId, type) {
    if (!S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;
    msg.likes = msg.likes || [];
    msg.dislikes = msg.dislikes || [];
    if (type === 'like') {
        msg.dislikes = msg.dislikes.filter(id => id !== S.user.id);
        if (msg.likes.indexOf(S.user.id) > -1) msg.likes = msg.likes.filter(id => id !== S.user.id);
        else msg.likes.push(S.user.id);
    } else {
        msg.likes = msg.likes.filter(id => id !== S.user.id);
        if (msg.dislikes.indexOf(S.user.id) > -1) msg.dislikes = msg.dislikes.filter(id => id !== S.user.id);
        else msg.dislikes.push(S.user.id);
    }
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function toggleReplyReaction(groupId, parentId, replyId, type) {
    if (!S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    function findR(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findR(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }
    const msg = (g.messages || []).find(m => m.id === parentId);
    if (!msg) return;
    const r = findR(msg.replies || []);
    if (!r) return;
    r.likes = r.likes || [];
    r.dislikes = r.dislikes || [];
    if (type === 'like') {
        r.dislikes = r.dislikes.filter(id => id !== S.user.id);
        if (r.likes.indexOf(S.user.id) > -1) r.likes = r.likes.filter(id => id !== S.user.id);
        else r.likes.push(S.user.id);
    } else {
        r.likes = r.likes.filter(id => id !== S.user.id);
        if (r.dislikes.indexOf(S.user.id) > -1) r.dislikes = r.dislikes.filter(id => id !== S.user.id);
        else r.dislikes.push(S.user.id);
    }
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function replyToMessage(groupId, msgId) {
    const text = prompt('پاسخ:');
    if (!text || !S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === msgId);
    if (!msg) return;
    msg.replies = msg.replies || [];
    msg.replies.push({
        id: uid('r_'), userId: S.user.id, userName: S.user.displayName,
        userAvatar: S.user.avatar, content: parseMentions(esc(text)),
        createdAt: Date.now(), likes: [], dislikes: [], replies: [], edited: false
    });
    DB.setGroups(groups);
    renderGroupPage(groupId);
}

function replyToReply(groupId, parentId, replyId) {
    const text = prompt('پاسخ:');
    if (!text || !S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const msg = (g.messages || []).find(m => m.id === parentId);
    if (!msg) return;
    function findR(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findR(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }
    const r = findR(msg.replies || []);
    if (!r) return;
    r.replies = r.replies || [];
    r.replies.push({
        id: uid('r_'), userId: S.user.id, userName: S.user.displayName,
        userAvatar: S.user.avatar, content: esc(text),
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
    msg.content = parseMentions(esc(newText));
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
    function findR(list) {
        for (let i = 0; i < list.length; i++) {
            if (list[i].id === replyId) return list[i];
            if (list[i].replies && list[i].replies.length) {
                const f = findR(list[i].replies);
                if (f) return f;
            }
        }
        return null;
    }
    const r = findR(msg.replies || []);
    if (!r) return;
    const newText = prompt('متن جدید:', stripHtml(r.content));
    if (!newText || !newText.trim()) return;
    r.content = esc(newText);
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
    if (!S.user) { toast('اول وارد شو'); return; }
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    if ((g.banned || []).indexOf(S.user.id) > -1) { toast('بن شدی'); return; }
    g.members = g.members || [];
    if (g.members.indexOf(S.user.id) === -1) g.members.push(S.user.id);
    const users = DB.getUsers();
    const me = users.find(u => u.id === S.user.id);
    if (me) {
        me.groups = me.groups || [];
        if (me.groups.indexOf(groupId) === -1) me.groups.push(groupId);
        DB.setUsers(users);
        S.user = me;
    }
    DB.setGroups(groups);
    toast('عضو شدی');
    renderGroupPage(groupId);
}

function requestJoinGroup(groupId) {
    if (!S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    g.joinRequests = g.joinRequests || [];
    if (g.joinRequests.indexOf(S.user.id) === -1) g.joinRequests.push(S.user.id);
    DB.setGroups(groups);
    const notifs = DB.getNotifs();
    notifs.push({ id: uid('n_'), userId: g.ownerId, type: 'group_request',
        text: S.user.displayName + ' درخواست عضویت در گروه «' + g.name + '» داد',
        link: 'group:' + g.id, ts: Date.now(), read: false });
    DB.setNotifs(notifs);
    toast('درخواست فرستاده شد');
}

function openGroupSettings(groupId) {
    if (!S.user) return;
    const groups = DB.getGroups();
    const g = groups.find(x => x.id === groupId);
    if (!g) return;
    const isOwner = g.ownerId === S.user.id;
    const isAdmin = (g.admins || []).indexOf(S.user.id) > -1;
    const isMod = (g.mods || []).indexOf(S.user.id) > -1;
    const isSiteAdmin = S.user.role === 'admin';
    if (!isOwner && !isAdmin && !isMod && !isSiteAdmin) { toast('دسترسی نداری'); return; }

    const box = $('#groupSettingsBody');
    if (!box) return;

    const users = DB.getUsers();
    const membersHtml = (g.members || []).map(mid => {
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
                '<div class="user-avatar" style="width:32px;height:32px;font-size:12px;">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                '<div style="min-width:0;"><strong style="font-size:13px;">' + esc(u.displayName) + '</strong> ' + roleLabel +
                    '<div style="font-size:11px;color:var(--tx-mute);direction:ltr;">@' + esc(u.username) + '</div></div>' +
            '</div><div style="display:flex;gap:4px;flex-wrap:wrap;">' + btns + '</div></div>';
    }).join('');

    let requestsHtml = '';
    if ((g.joinRequests || []).length) {
        requestsHtml = '<h4 style="font-size:14px;font-weight:800;margin:16px 0 10px;">درخواست‌ها</h4>' +
            g.joinRequests.map(mid => {
                const u = users.find(x => x.id === mid);
                if (!u) return '';
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;"><strong>' + esc(u.displayName) + '</strong>' +
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
            '<div class="group-page-avatar" style="margin:0 auto 10px;">' + (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0].toUpperCase()) + '</div>' +
            '<button class="btn-ghost small" id="changeGroupAvatar" type="button">تغییر آواتار</button>' +
            '<input type="file" id="groupAvatarFile" accept="image/*" hidden>' +
        '</div>' +
        '<div class="form-group" style="margin-bottom:14px;"><label>اسم گروه</label><input type="text" id="gName" value="' + esc(g.name) + '"></div>' +
        '<div class="form-group" style="margin-bottom:14px;"><label>توضیحات</label><textarea id="gDesc">' + esc(g.description || '') + '</textarea></div>' +
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
            gg.messages.push({ id: uid('m_'), userId: 'system', userName: 'سیستم',
                content: 'اسم گروه از «' + esc(oldName) + '» به «' + esc(newName) + '» تغییر کرد',
                createdAt: Date.now(), likes: [], dislikes: [], replies: [] });
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
            const gs = DB.getGroups(); const gg = gs.find(x => x.id === groupId);
            gg.admins = gg.admins || [];
            if (gg.admins.indexOf(pa.dataset.promoteAdmin) === -1) gg.admins.push(pa.dataset.promoteAdmin);
            DB.setGroups(gs); toast('ادمین شد'); closeModal('groupSettingsOverlay'); openGroupSettings(groupId);
        }
        if (pm) {
            const gs = DB.getGroups(); const gg = gs.find(x => x.id === groupId);
            gg.mods = gg.mods || [];
            if (gg.mods.indexOf(pm.dataset.promoteMod) === -1) gg.mods.push(pm.dataset.promoteMod);
            DB.setGroups(gs); toast('ناظر شد'); closeModal('groupSettingsOverlay'); openGroupSettings(groupId);
        }
        if (ban) {
            if (!confirm('بن بشه؟')) return;
            const gs = DB.getGroups(); const gg = gs.find(x => x.id === groupId);
            gg.banned = gg.banned || [];
            if (gg.banned.indexOf(ban.dataset.banMember) === -1) gg.banned.push(ban.dataset.banMember);
            gg.members = (gg.members || []).filter(id => id !== ban.dataset.banMember);
            const bannedU = getUserById(ban.dataset.banMember);
            gg.messages = gg.messages || [];
            gg.messages.push({ id: uid('m_'), userId: 'system', userName: 'سیستم',
                content: '«' + esc(bannedU ? bannedU.displayName : 'کاربر') + '» توسط «' + esc(S.user.displayName) + '» بن شد',
                createdAt: Date.now(), likes: [], dislikes: [], replies: [] });
            DB.setGroups(gs); toast('بن شد'); closeModal('groupSettingsOverlay'); openGroupSettings(groupId);
        }
        if (acc) {
            const gs = DB.getGroups(); const gg = gs.find(x => x.id === groupId);
            gg.joinRequests = (gg.joinRequests || []).filter(id => id !== acc.dataset.acceptJoin);
            gg.members = gg.members || [];
            if (gg.members.indexOf(acc.dataset.acceptJoin) === -1) gg.members.push(acc.dataset.acceptJoin);
            DB.setGroups(gs); toast('قبول شد'); closeModal('groupSettingsOverlay'); openGroupSettings(groupId);
        }
        if (rej) {
            const gs = DB.getGroups(); const gg = gs.find(x => x.id === groupId);
            gg.joinRequests = (gg.joinRequests || []).filter(id => id !== rej.dataset.rejectJoin);
            DB.setGroups(gs); closeModal('groupSettingsOverlay'); openGroupSettings(groupId);
        }
    });
}

/* ═══════ Users ═══════ */
function renderUsersPage() {
    const grid = $('#usersGrid');
    if (!grid) return;
    const users = DB.getUsers();
    grid.innerHTML = '';
    users.forEach(u => {
        if (S.user && hasBlockedMe(S.user.id, u.id)) return;
        const card = document.createElement('div');
        card.className = 'user-card';
        const coverHtml = u.cover ? '<div class="user-card-cover"><img src="' + u.cover + '"></div>' : '<div class="user-card-cover"></div>';
        card.innerHTML = coverHtml +
            '<div class="user-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0].toUpperCase()) + '</div>' +
            '<h3>' + esc(u.displayName) + badgesHtml(u) + '</h3>' +
            '<p>@' + esc(u.username) + '</p>';
        card.addEventListener('click', () => showPage('profile', u.id));
        grid.appendChild(card);
    });
}

/* ═══════ Profile ═══════ */
function renderProfilePage(userId) {
    const box = $('#userProfileContent');
    if (!box) return;
    const u = getUserById(userId);
    if (!u) { box.innerHTML = '<div class="empty-state"><h3>کاربر پیدا نشد</h3></div>'; return; }

    if (S.user && S.user.id !== userId && hasBlockedMe(S.user.id, userId)) {
        box.innerHTML = '<div class="profile-blocked-message"><h3>کاربر بلاکت کرده</h3><p>نمی‌تونی پروفایلش رو ببینی</p></div>';
        return;
    }

    const isMe = S.user && S.user.id === userId;
    const isFriend = S.user && (S.user.friends || []).indexOf(userId) > -1;
    const hasPending = S.user && (S.user.friendRequests || []).indexOf(userId) > -1;
    const iBlocked = S.user && isBlocked(S.user.id, userId);

    const coverHtml = u.cover ? '<div class="profile-cover"><img src="' + u.cover + '"></div>' : '<div class="profile-cover"></div>';
    let actionsHtml = '';
    if (!isMe && S.user) {
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
        actionsHtml = '<div class="profile-actions"><button class="btn-primary small" id="editMyProfileBtn" type="button">ویرایش پروفایل</button></div>';
    }

    const posts = DB.getPosts().filter(p => p.authorId === userId);
    const commentsCount = DB.getPosts().reduce((sum, p) => sum + (p.comments || []).filter(c => c.userId === userId).length, 0);
    const platformLabel = { ps5: 'PlayStation 5', xbox: 'Xbox', switch: 'Nintendo Switch', pc: 'PC', mobile: 'موبایل' }[u.platform] || 'PC';

    box.innerHTML = coverHtml +
        '<div class="profile-header">' +
            '<div class="profile-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0].toUpperCase()) + '</div>' +
            '<div class="profile-info">' +
                '<h1>' + esc(u.displayName) + badgesHtml(u) + '</h1>' +
                '<div class="username">@' + esc(u.username) + '</div>' +
                (u.title ? '<div class="title">' + esc(u.title) + '</div>' : '') +
            '</div>' + actionsHtml +
        '</div>' +
        '<div class="profile-stats">' +
            '<div class="profile-stat"><strong>' + faNum(u.xp || 0) + '</strong><span>امتیاز</span></div>' +
            '<div class="profile-stat"><strong>' + faNum(posts.length) + '</strong><span>پست</span></div>' +
            '<div class="profile-stat"><strong>' + faNum(commentsCount) + '</strong><span>نظر</span></div>' +
            '<div class="profile-stat"><strong>' + faNum((u.friends || []).length) + '</strong><span>دوست</span></div>' +
        '</div>' +
        (u.bio ? '<div class="profile-bio"><h3>درباره من</h3><p>' + esc(u.bio) + '</p></div>' : '') +
        '<div class="profile-bio"><h3>اطلاعات</h3><div class="profile-details-grid">' +
            '<div class="profile-detail-item"><div class="label">پلتفرم</div><div class="value">' + platformLabel + '</div></div>' +
            (u.birthday ? '<div class="profile-detail-item"><div class="label">تاریخ تولد</div><div class="value">' + esc(u.birthday) + '</div></div>' : '') +
            (u.website ? '<div class="profile-detail-item"><div class="label">وبسایت</div><div class="value" style="direction:ltr;">' + esc(u.website) + '</div></div>' : '') +
            (u.favGames ? '<div class="profile-detail-item"><div class="label">بازی‌های مورد علاقه</div><div class="value">' + esc(u.favGames) + '</div></div>' : '') +
            (u.favMovies ? '<div class="profile-detail-item"><div class="label">فیلم‌های مورد علاقه</div><div class="value">' + esc(u.favMovies) + '</div></div>' : '') +
            (u.instagram ? '<div class="profile-detail-item"><div class="label">اینستاگرام</div><div class="value" style="direction:ltr;">' + esc(u.instagram) + '</div></div>' : '') +
            (u.telegram ? '<div class="profile-detail-item"><div class="label">تلگرام</div><div class="value" style="direction:ltr;">' + esc(u.telegram) + '</div></div>' : '') +
            (u.discord ? '<div class="profile-detail-item"><div class="label">دیسکورد</div><div class="value" style="direction:ltr;">' + esc(u.discord) + '</div></div>' : '') +
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
    if (!S.user) return;
    const users = DB.getUsers();
    const me = users.find(u => u.id === S.user.id);
    const other = users.find(u => u.id === userId);
    if (!me || !other) return;
    me.friends = (me.friends || []).filter(id => id !== userId);
    other.friends = (other.friends || []).filter(id => id !== me.id);
    DB.setUsers(users);
    S.user = me;
    updateBadges();
    toast('لغو دوستی شد');
}

function sendFriendRequest(targetId) {
    if (!S.user) { toast('اول وارد شو'); return; }
    if (targetId === S.user.id) return;
    const users = DB.getUsers();
    const me = users.find(u => u.id === S.user.id);
    const target = users.find(u => u.id === targetId);
    if (!me || !target) return;
    if ((me.friends || []).indexOf(targetId) > -1) { toast('قبلا دوستته'); return; }
    if ((target.friendRequests || []).indexOf(me.id) > -1) { toast('قبلا درخواست دادی'); return; }
    target.friendRequests = target.friendRequests || [];
    target.friendRequests.push(me.id);
    DB.setUsers(users);
    S.user = me;
    const notifs = DB.getNotifs();
    notifs.push({ id: uid('n_'), userId: targetId, type: 'friend_request',
        text: me.displayName + ' بهت درخواست دوستی داد', ts: Date.now(), read: false });
    DB.setNotifs(notifs);
    toast('درخواست فرستاده شد');
}

function sendDirectMessage(toId, text) {
    if (!S.user) return;
    const messages = DB.getMessages();
    messages.push({ id: uid('m_'), from: S.user.id, to: toId, text, ts: Date.now(), read: false });
    DB.setMessages(messages);
    const notifs = DB.getNotifs();
    notifs.push({ id: uid('n_'), userId: toId, type: 'message',
        text: S.user.displayName + ' بهت پیام داد', ts: Date.now(), read: false });
    DB.setNotifs(notifs);
    toast('پیام فرستاده شد');
}

/* ═══════ User Panel ═══════ */
function openUserPanel(tab) {
    if (!S.user) { openModal('authOverlay'); return; }
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
    if (!body || !S.user) return;
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
    const u = S.user;
    const posts = DB.getPosts().filter(p => p.authorId === u.id);
    let cc = 0;
    DB.getPosts().forEach(p => (p.comments || []).forEach(c => { if (c.userId === u.id) cc++; }));
    let roleLabel = 'کاربر عادی';
    if (u.role === 'admin') roleLabel = 'مدیر سایت';
    else if (u.role === 'editor') roleLabel = 'سردبیر';
    else if (u.role === 'author') roleLabel = 'نویسنده';
    return '<div class="up-content active"><div class="panel-stats-grid">' +
            '<div class="panel-stat-box"><strong>' + faNum(u.xp || 0) + '</strong><span>امتیاز</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(u.level || 1) + '</strong><span>سطح</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(posts.length) + '</strong><span>پست</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum(cc) + '</strong><span>نظر</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum((u.friends || []).length) + '</strong><span>دوست</span></div>' +
            '<div class="panel-stat-box"><strong>' + faNum((u.groups || []).length) + '</strong><span>گروه</span></div>' +
        '</div>' +
        '<div style="padding:14px;border-radius:14px;background:var(--field);border:1px solid var(--bd);">' +
            '<div style="font-size:12px;color:var(--tx-mute);margin-bottom:6px;">وضعیت حساب</div>' +
            '<div style="font-size:14px;font-weight:700;">' + roleLabel + '</div></div>' +
        '<button class="btn-ghost full" id="logoutBtn" type="button" style="margin-top:16px;color:var(--bad);border-color:var(--bad);">خروج از حساب</button></div>';
}

function renderProfileTab() {
    const u = S.user;
    const initial = (u.displayName || 'U')[0].toUpperCase();
    return '<div class="up-content active"><div class="profile-form">' +
        '<div class="profile-cover-section">' +
            '<div class="profile-cover-preview">' + (u.cover ? '<img src="' + u.cover + '">' : '') + '</div>' +
            '<button class="btn-ghost small" id="changeCoverBtn" type="button">تغییر کاور</button>' +
            '<input type="file" id="coverFile" accept="image/*" hidden>' +
        '</div>' +
        '<div class="profile-avatar-section">' +
            '<div class="user-avatar">' + (u.avatar ? '<img src="' + u.avatar + '">' : initial) + '</div>' +
            '<button class="btn-ghost small" id="changeAvatarBtn" type="button">تغییر آواتار</button>' +
            '<input type="file" id="avatarFile" accept="image/*" hidden>' +
        '</div>' +
        '<div class="form-group"><label>لقب</label><input type="text" id="pTitle" value="' + esc(u.title || '') + '"></div>' +
        '<div class="form-row">' +
            '<div class="form-group"><label>نام</label><input type="text" id="pFirstName" value="' + esc(u.firstName || '') + '"></div>' +
            '<div class="form-group"><label>نام خانوادگی</label><input type="text" id="pLastName" value="' + esc(u.lastName || '') + '"></div>' +
        '</div>' +
        '<div class="form-group"><label>نام نمایشی</label><input type="text" id="pDisplayName" value="' + esc(u.displayName) + '"></div>' +
        '<div class="form-group"><label>تاریخ تولد</label><input type="text" id="pBirthday" value="' + esc(u.birthday || '') + '"></div>' +
        '<div class="form-group"><label>پلتفرم</label><select id="pPlatform">' +
            '<option value="ps5"' + (u.platform === 'ps5' ? ' selected' : '') + '>PlayStation 5</option>' +
            '<option value="xbox"' + (u.platform === 'xbox' ? ' selected' : '') + '>Xbox</option>' +
            '<option value="switch"' + (u.platform === 'switch' ? ' selected' : '') + '>Nintendo Switch</option>' +
            '<option value="pc"' + (u.platform === 'pc' ? ' selected' : '') + '>PC</option>' +
            '<option value="mobile"' + (u.platform === 'mobile' ? ' selected' : '') + '>موبایل</option>' +
        '</select></div>' +
        '<div class="form-group"><label>وبسایت</label><input type="text" id="pWebsite" value="' + esc(u.website || '') + '" dir="ltr"></div>' +
        '<div class="form-group"><label>بیوگرافی</label><textarea id="pBio">' + esc(u.bio || '') + '</textarea></div>' +
        '<div class="form-group"><label>بازی‌های مورد علاقه</label><input type="text" id="pFavGames" value="' + esc(u.favGames || '') + '"></div>' +
        '<div class="form-group"><label>فیلم‌های مورد علاقه</label><input type="text" id="pFavMovies" value="' + esc(u.favMovies || '') + '"></div>' +
        '<div class="form-group"><label>اینستاگرام</label><input type="text" id="pInstagram" value="' + esc(u.instagram || '') + '" dir="ltr"></div>' +
        '<div class="form-group"><label>تلگرام</label><input type="text" id="pTelegram" value="' + esc(u.telegram || '') + '" dir="ltr"></div>' +
        '<div class="form-group"><label>دیسکورد</label><input type="text" id="pDiscord" value="' + esc(u.discord || '') + '" dir="ltr"></div>' +
        '<button class="btn-primary full" id="saveProfileBtn" type="button">ذخیره پروفایل</button>' +
    '</div></div>';
}

function renderNotifsTab() {
    const notifs = DB.getNotifs().filter(n => n.userId === S.user.id).reverse();
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
            '<div class="notif-body"><p>' + esc(n.text) + '</p><small>' + timeAgo(n.ts) + '</small></div></div>';
    });
    html += '</div>';
    return html;
}

function renderMessagesTab() {
    const msgs = DB.getMessages().filter(m => m.to === S.user.id || m.from === S.user.id).reverse();
    if (!msgs.length) return '<div class="empty-state"><h3>پیامی نداری</h3></div>';
    let html = '<div class="up-content active">';
    msgs.forEach(m => {
        const isMine = m.from === S.user.id;
        const otherId = isMine ? m.to : m.from;
        const other = getUserById(otherId);
        html += '<div class="notif-item"><div class="user-avatar" style="width:36px;height:36px;">' +
            (other && other.avatar ? '<img src="' + other.avatar + '">' : (other ? other.displayName[0] : 'U')) + '</div>' +
            '<div class="notif-body"><p><strong>' + (isMine ? 'شما' : esc(other ? other.displayName : 'کاربر')) + ':</strong> ' + esc(m.text) + '</p>' +
            '<small>' + timeAgo(m.ts) + '</small></div></div>';
    });
    html += '</div>';
    return html;
}

function renderFriendsTab() {
    const u = S.user;
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
                '<div class="notif-body"><p><strong>' + esc(r.displayName) + '</strong> @' + esc(r.username) + '</p>' +
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
                '<div class="notif-body"><p><strong>' + esc(f.displayName) + '</strong></p>' +
                '<small>@' + esc(f.username) + '</small></div>' +
                '<button class="btn-ghost small" data-chat-friend="' + fid + '" type="button">پیام</button></div>';
        });
    }
    html += '</div>';
    return html;
}

function renderGroupsTab() {
    const u = S.user;
    const groups = DB.getGroups().filter(g => (u.groups || []).indexOf(g.id) > -1);
    if (!groups.length) return '<div class="empty-state"><h3>توی هیچ گروهی نیستی</h3></div>';
    let html = '<div class="up-content active">';
    groups.forEach(g => {
        html += '<div class="notif-item" data-group-link="' + g.id + '" style="cursor:pointer;">' +
            '<div class="user-avatar" style="width:36px;height:36px;font-size:14px;">' +
            (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0]) + '</div>' +
            '<div class="notif-body"><p><strong>' + esc(g.name) + '</strong></p>' +
            '<small>' + faNum((g.members || []).length) + ' عضو</small></div></div>';
    });
    html += '</div>';
    return html;
}

function renderBlockedTab() {
    const b = DB.getBlocks();
    const myBlocked = b[S.user.id] || [];
    if (!myBlocked.length) return '<div class="empty-state"><h3>کسی رو بلاک نکردی</h3></div>';
    const users = DB.getUsers();
    let html = '<div class="up-content active">';
    myBlocked.forEach(bid => {
        const u = users.find(x => x.id === bid);
        if (!u) return;
        html += '<div class="notif-item"><div class="user-avatar" style="width:36px;height:36px;">' +
            (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
            '<div class="notif-body"><p><strong>' + esc(u.displayName) + '</strong></p>' +
            '<small>@' + esc(u.username) + '</small></div>' +
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
        const chAv = $('#changeAvatarBtn'); const avInp = $('#avatarFile');
        if (chAv && avInp) {
            chAv.addEventListener('click', () => avInp.click());
            avInp.addEventListener('change', e => { const f = e.target.files[0]; if (f) openCrop(f, 'avatar-user', S.user.id); });
        }
        const chCv = $('#changeCoverBtn'); const cvInp = $('#coverFile');
        if (chCv && cvInp) {
            chCv.addEventListener('click', () => cvInp.click());
            cvInp.addEventListener('change', e => { const f = e.target.files[0]; if (f) openCrop(f, 'cover-user', S.user.id); });
        }
        const sv = $('#saveProfileBtn');
        if (sv) sv.addEventListener('click', () => {
            const users = DB.getUsers();
            const me = users.find(u => u.id === S.user.id);
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
            S.user = me;
            updateAuthUI();
            toast('ذخیره شد');
        });
    }
    if (tab === 'notifications') {
        const mar = $('#markAllRead');
        if (mar) mar.addEventListener('click', () => {
            const notifs = DB.getNotifs();
            notifs.forEach(n => { if (n.userId === S.user.id) n.read = true; });
            DB.setNotifs(notifs);
            updateBadges();
            renderUserPanelBody('notifications');
        });
        $$('[data-notif-id]').forEach(el => {
            el.addEventListener('click', () => {
                const notifs = DB.getNotifs();
                const n = notifs.find(x => x.id === el.dataset.notifId);
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
            const t = prompt('پیام:'); if (t) sendDirectMessage(b.dataset.chatFriend, t);
        }));
    }
    if (tab === 'groups') {
        $$('[data-group-link]').forEach(el => el.addEventListener('click', () => {
            closeUserPanel(); showPage('group', el.dataset.groupLink);
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
    const me = users.find(u => u.id === S.user.id);
    const other = users.find(u => u.id === fromId);
    if (!me || !other) return;
    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    me.friends = me.friends || []; other.friends = other.friends || [];
    if (me.friends.indexOf(fromId) === -1) me.friends.push(fromId);
    if (other.friends.indexOf(me.id) === -1) other.friends.push(me.id);
    DB.setUsers(users);
    S.user = me;
    updateBadges();
    renderUserPanelBody('friends');
    toast('حالا دوستید');
}

function rejectFriend(fromId) {
    const users = DB.getUsers();
    const me = users.find(u => u.id === S.user.id);
    if (!me) return;
    me.friendRequests = (me.friendRequests || []).filter(id => id !== fromId);
    DB.setUsers(users);
    S.user = me;
    updateBadges();
    renderUserPanelBody('friends');
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
    closeUserPanel(); closeDrawer();
}

/* ═══════ Auth ═══════ */
function initAuth() {
    $$('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.authTab;
            $$('.auth-tab').forEach(t => t.classList.toggle('active', t === tab));
            const lf = $('#loginForm'); const rf = $('#registerForm');
            if (lf) { lf.classList.toggle('active', target === 'login'); lf.hidden = target !== 'login'; }
            if (rf) { rf.classList.toggle('active', target === 'register'); rf.hidden = target !== 'register'; }
        });
    });

    const lf = $('#loginForm');
    if (lf) lf.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const username = fd.get('username'); const password = fd.get('password');
        const users = DB.getUsers();
        const clean = username.toLowerCase().trim();
        const user = users.find(u => u.username === clean);
        if (!user) { toast('کاربری با این نام پیدا نشد'); return; }
        if (user.passHash !== hashPass(password)) { toast('رمز اشتباهه'); return; }
        user.lastSeen = Date.now();
        DB.setUsers(users);
        DB.setSession({ userId: user.id, ts: Date.now() });
        S.user = user;
        updateAuthUI();
        closeModal('authOverlay');
        e.target.reset();
        toast('خوش اومدی ' + user.displayName);
    });

    const rf = $('#registerForm');
    if (rf) rf.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const username = fd.get('username'); const displayName = fd.get('displayName');
        const password = fd.get('password'); const platform = fd.get('platform') || 'pc';
        const clean = username.toLowerCase().trim();
        if (!/^[a-z][a-z0-9_]{2,19}$/.test(clean)) { toast('نام کاربری فقط با حروف انگلیسی'); return; }
        const users = DB.getUsers();
        if (users.some(u => u.username === clean)) { toast('این نام کاربری گرفته شده'); return; }
        if (password.length < 6) { toast('رمز باید حداقل ۶ کاراکتر باشه'); return; }
        const user = {
            id: uid('u_'), username: clean, displayName: displayName.trim() || clean,
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
        S.user = user;
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
    renderAdminTab(S.adminTab);
}

function renderAdminTab(tab) {
    S.adminTab = tab;
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
        body.innerHTML = '<div class="admin-stats-grid">' +
            '<div class="admin-stat-card"><strong>' + faNum(users.length) + '</strong><span>کاربران</span></div>' +
            '<div class="admin-stat-card green"><strong>' + faNum(posts.length) + '</strong><span>پست‌ها</span></div>' +
            '<div class="admin-stat-card pink"><strong>' + faNum(totalViews) + '</strong><span>بازدید کل</span></div>' +
            '<div class="admin-stat-card orange"><strong>' + faNum(totalLikes) + '</strong><span>لایک کل</span></div>' +
            '<div class="admin-stat-card"><strong>' + faNum(totalComments) + '</strong><span>کامنت کل</span></div>' +
            '<div class="admin-stat-card green"><strong>' + faNum(groups.length) + '</strong><span>گروه‌ها</span></div>' +
            '<div class="admin-stat-card orange"><strong>' + faNum(pending.length) + '</strong><span>در انتظار</span></div>' +
            '<div class="admin-stat-card pink"><strong>' + faNum(DB.getActivity().length) + '</strong><span>فعالیت‌ها</span></div></div>';
    }
    else if (tab === 'users') {
        body.innerHTML = users.map(u =>
            '<div class="admin-user-row"><div class="admin-user-info">' +
                '<div class="user-avatar" style="width:36px;height:36px;">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                '<div><strong style="font-size:13px;">' + esc(u.displayName) + '</strong>' + badgesHtml(u) +
                    '<div style="font-size:11px;color:var(--tx-mute);">@' + esc(u.username) + ' · ' + u.role + '</div></div>' +
            '</div><div class="admin-user-actions">' +
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
            '</div></div>').join('');
    }
    else if (tab === 'posts') {
        body.innerHTML = posts.length ? posts.map(p =>
            '<div class="admin-user-row"><div class="admin-user-info">' +
                '<div><strong style="font-size:13px;">' + esc(p.title) + '</strong>' +
                    '<div style="font-size:11px;color:var(--tx-mute);">' + esc(p.authorName || '') + ' · ' + timeAgo(p.createdAt) + '</div></div>' +
            '</div><div class="admin-user-actions">' +
                '<button class="btn-ghost small" data-edit-post="' + p.id + '" type="button">ویرایش</button>' +
                '<button class="btn-ghost small danger" data-delete-post="' + p.id + '" type="button">حذف</button>' +
            '</div></div>').join('') : '<div class="empty-state"><h3>پستی نیست</h3></div>';
    }
    else if (tab === 'comments') {
        if (!pending.length) { body.innerHTML = '<div class="empty-state"><h3>کامنت در انتظاری نیست</h3></div>'; }
        else {
            body.innerHTML = pending.map(item => {
                const u = getUserById(item.comment.userId);
                return '<div class="pending-item"><div class="pending-item-head">' +
                    '<div class="user-avatar" style="width:32px;height:32px;">' + (u && u.avatar ? '<img src="' + u.avatar + '">' : (u ? u.displayName[0] : '؟')) + '</div>' +
                    '<div><strong>' + esc(u ? u.displayName : 'ناشناس') + '</strong>' +
                        '<div style="font-size:11px;color:var(--tx-mute);">' + timeAgo(item.addedAt) + '</div></div></div>' +
                    '<div class="pending-item-body">' + item.comment.content + '</div>' +
                    '<div class="pending-actions">' +
                        '<button class="btn-primary small" data-approve-comment="' + item.comment.id + '" type="button">تأیید</button>' +
                        '<button class="btn-ghost small danger" data-reject-comment="' + item.comment.id + '" type="button">رد</button>' +
                    '</div></div>';
            }).join('');
        }
    }
    else if (tab === 'groups') {
        body.innerHTML = groups.length ? groups.map(g =>
            '<div class="admin-user-row"><div class="admin-user-info">' +
                '<div class="user-avatar" style="width:36px;height:36px;font-size:14px;">' + (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0]) + '</div>' +
                '<div><strong style="font-size:13px;">' + esc(g.name) + '</strong>' +
                    '<div style="font-size:11px;color:var(--tx-mute);">' + (g.type === 'public' ? 'عمومی' : 'خصوصی') + ' · ' + faNum((g.members || []).length) + ' عضو</div></div>' +
            '</div><div class="admin-user-actions">' +
                '<button class="btn-ghost small" data-view-group="' + g.id + '" type="button">مشاهده</button>' +
                '<button class="btn-ghost small danger" data-delete-group="' + g.id + '" type="button">حذف</button>' +
            '</div></div>').join('') : '<div class="empty-state"><h3>گروهی نیست</h3></div>';
    }
    else if (tab === 'roles') {
        const authors = users.filter(u => u.role === 'author' || u.role === 'editor');
        body.innerHTML = '<h4 style="font-size:14px;font-weight:800;margin-bottom:14px;">تیم تحریریه</h4>' +
            (authors.length ? authors.map(u =>
                '<div class="admin-user-row"><div class="admin-user-info">' +
                    '<div class="user-avatar" style="width:36px;height:36px;">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                    '<div><strong>' + esc(u.displayName) + '</strong>' + badgesHtml(u) +
                        '<div style="font-size:11px;color:var(--tx-mute);">' + u.role + '</div></div>' +
                '</div></div>').join('') : '<div class="empty-state"><h3>تیم تحریریه خالیه</h3></div>');
    }
    else if (tab === 'backup') {
        body.innerHTML = '<div style="padding:20px;border-radius:14px;background:var(--field);border:1px solid var(--bd);margin-bottom:14px;">' +
            '<h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">خروجی</h4>' +
            '<button class="btn-primary full" id="exportDataBtn" type="button">دانلود پشتیبان JSON</button></div>' +
            '<div style="padding:20px;border-radius:14px;background:var(--field);border:1px solid var(--bd);">' +
            '<h4 style="font-size:14px;font-weight:800;margin-bottom:10px;">ورودی</h4>' +
            '<button class="btn-ghost full" id="importDataBtn" type="button">بازیابی از فایل</button>' +
            '<input type="file" id="importDataInput" accept=".json" hidden></div>';
    }
}

/* ═══════ Editor Panel ═══════ */
function openEditorPanel() {
    const p = $('#editorPanel');
    if (!p) return;
    p.hidden = false;
    renderEditorTab('myposts');
}

function renderEditorTab(tab) {
    const body = $('#editorBody');
    if (!body) return;
    $$('.sm-tab[data-editor-tab]').forEach(t => t.classList.toggle('active', t.dataset.editorTab === tab));

    const posts = DB.getPosts().filter(p => p.authorId === S.user.id);
    const pending = DB.getPending();

    if (tab === 'myposts') {
        body.innerHTML = posts.length ? posts.map(p =>
            '<div class="admin-user-row"><div class="admin-user-info">' +
                '<div><strong style="font-size:13px;">' + esc(p.title) + '</strong>' +
                    '<div style="font-size:11px;color:var(--tx-mute);">' + timeAgo(p.createdAt) + ' · ' + faNum(p.views || 0) + ' بازدید</div></div>' +
            '</div><div class="admin-user-actions">' +
                '<button class="btn-ghost small" data-edit-post="' + p.id + '" type="button">ویرایش</button></div></div>').join('')
            : '<div class="empty-state"><h3>هنوز پستی نداری</h3><button class="btn-primary" id="newPostFromEditor" type="button" style="margin-top:14px;">ساخت پست جدید</button></div>';
        const np = $('#newPostFromEditor');
        if (np) np.addEventListener('click', () => openEditor());
    }
    else if (tab === 'featured') {
        const allPublished = DB.getPosts().filter(p => p.status === 'published');
        body.innerHTML = '<h4 style="font-size:14px;font-weight:800;margin-bottom:14px;">انتخاب پست‌های منتخب سردبیر</h4>' +
            (allPublished.length ? allPublished.map(p =>
                '<div class="admin-user-row"><div class="admin-user-info">' +
                    '<div><strong style="font-size:13px;">' + esc(p.title) + '</strong>' +
                        '<div style="font-size:11px;color:var(--tx-mute);">' + esc(p.authorName || '') + '</div></div>' +
                '</div><div class="admin-user-actions">' +
                    '<button class="btn-ghost small" data-feature-post="' + p.id + '" type="button">' +
                        (p.editorChoice ? 'حذف انتخاب' : 'انتخاب سردبیر') + '</button></div></div>').join('')
            : '<div class="empty-state"><h3>پستی نیست</h3></div>');
    }
    else if (tab === 'comments') {
        if (!pending.length) { body.innerHTML = '<div class="empty-state"><h3>کامنت در انتظاری نیست</h3></div>'; }
        else {
            body.innerHTML = pending.map(item => {
                const u = getUserById(item.comment.userId);
                return '<div class="pending-item"><div class="pending-item-head">' +
                    '<div class="user-avatar" style="width:32px;height:32px;">' + (u && u.avatar ? '<img src="' + u.avatar + '">' : (u ? u.displayName[0] : '؟')) + '</div>' +
                    '<div><strong>' + esc(u ? u.displayName : 'ناشناس') + '</strong>' +
                        '<div style="font-size:11px;color:var(--tx-mute);">' + timeAgo(item.addedAt) + '</div></div></div>' +
                    '<div class="pending-item-body">' + item.comment.content + '</div>' +
                    '<div class="pending-actions">' +
                        '<button class="btn-primary small" data-approve-comment="' + item.comment.id + '" type="button">تأیید</button>' +
                        '<button class="btn-ghost small danger" data-reject-comment="' + item.comment.id + '" type="button">رد</button>' +
                    '</div></div>';
            }).join('');
        }
    }
    else if (tab === 'ticks') {
        const users = DB.getUsers().filter(u => u.role !== 'admin' && u.role !== 'editor');
        body.innerHTML = '<h4 style="font-size:14px;font-weight:800;margin-bottom:14px;">مدیریت تیک‌ها</h4>' +
            users.map(u =>
                '<div class="admin-user-row"><div class="admin-user-info">' +
                    '<div class="user-avatar" style="width:36px;height:36px;">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                    '<div><strong>' + esc(u.displayName) + '</strong>' + badgesHtml(u) + '</div>' +
                '</div><div class="admin-user-actions">' +
                    '<button class="btn-ghost small" data-tick-blue="' + u.id + '" type="button">آبی</button>' +
                    '<button class="btn-ghost small" data-tick-gold="' + u.id + '" type="button">طلایی</button>' +
                    '<button class="btn-ghost small" data-tick-none="' + u.id + '" type="button">حذف</button>' +
                '</div></div>').join('');
    }
}

/* ═══════ Author Panel ═══════ */
function openAuthorPanel() {
    const p = $('#authorPanel');
    if (!p) return;
    p.hidden = false;
    renderAuthorTab('myposts');
}

function renderAuthorTab(tab) {
    const body = $('#authorBody');
    if (!body) return;
    $$('.sm-tab[data-author-tab]').forEach(t => t.classList.toggle('active', t.dataset.authorTab === tab));

    const posts = DB.getPosts().filter(p => p.authorId === S.user.id);

    if (tab === 'myposts') {
        const published = posts.filter(p => p.status === 'published');
        body.innerHTML = published.length ? published.map(p =>
            '<div class="admin-user-row"><div class="admin-user-info">' +
                '<div><strong style="font-size:13px;">' + esc(p.title) + '</strong>' +
                    '<div style="font-size:11px;color:var(--tx-mute);">' + faNum(p.views || 0) + ' بازدید · ' + timeAgo(p.createdAt) + '</div></div>' +
            '</div><div class="admin-user-actions">' +
                '<button class="btn-ghost small" data-edit-post="' + p.id + '" type="button">ویرایش</button></div></div>').join('')
            : '<div class="empty-state"><h3>هنوز پستی نداری</h3></div>';
    }
    else if (tab === 'drafts') {
        const drafts = posts.filter(p => p.status === 'draft');
        body.innerHTML = drafts.length ? drafts.map(p =>
            '<div class="admin-user-row"><div class="admin-user-info">' +
                '<div><strong style="font-size:13px;">' + esc(p.title) + '</strong>' +
                    '<div style="font-size:11px;color:var(--tx-mute);">' + timeAgo(p.createdAt) + '</div></div>' +
            '</div><div class="admin-user-actions">' +
                '<button class="btn-ghost small" data-edit-post="' + p.id + '" type="button">ویرایش</button></div></div>').join('')
            : '<div class="empty-state"><h3>پیش‌نویسی نداری</h3></div>';
    }
}

/* ═══════ Editor ═══════ */
function openEditor(postId) {
    const u = S.user;
    if (!u) { openModal('authOverlay'); return; }
    if (u.role !== 'admin' && u.role !== 'editor' && u.role !== 'author') { toast('اجازه نداری'); return; }

    S.editingPostId = postId || null;
    const modal = $('#editorFullscreen');
    const titleEl = $('#editorTitle');
    const contentEl = $('#editorContent');
    const titleText = $('#editorTitleText');

    if (postId) {
        const post = DB.getPosts().find(p => p.id === postId);
        if (post) {
            titleEl.value = post.title;
            contentEl.innerHTML = post.content;
            $('#editorCategory').value = post.category;
            $('#editorPlatform').value = post.platform || 'all';
            $('#editorTags').value = (post.tags || []).join('، ');
            $('#editorCover').value = post.cover || '';
            $('#editorExcerpt').value = post.excerpt || '';
            $('#editorScore').value = post.score || '';
            $('#editorChoice').value = post.editorChoice ? 'true' : 'false';
            $('#editorPinned').value = post.pinned ? 'true' : 'false';
            if (titleText) titleText.textContent = 'ویرایش پست';
        }
    } else {
        titleEl.value = '';
        contentEl.innerHTML = '';
        $('#editorCategory').value = 'news';
        $('#editorPlatform').value = 'all';
        $('#editorTags').value = '';
        $('#editorCover').value = '';
        $('#editorExcerpt').value = '';
        $('#editorScore').value = '';
        $('#editorChoice').value = 'false';
        $('#editorPinned').value = 'false';
        if (titleText) titleText.textContent = 'پست جدید';
    }

    modal.hidden = false;
    document.body.style.overflow = 'hidden';
}

function closeEditor() {
    const modal = $('#editorFullscreen');
    if (modal) modal.hidden = true;
    document.body.style.overflow = '';
}

function savePost(isDraft) {
    const title = $('#editorTitle').value.trim();
    const content = $('#editorContent').innerHTML;
    if (!title || !content) { toast('عنوان و محتوا لازمه'); return; }

    const u = S.user;
    const posts = DB.getPosts();
    const existing = S.editingPostId ? posts.find(p => p.id === S.editingPostId) : null;

    const data = {
        id: S.editingPostId || uid('p_'),
        title, content,
        category: $('#editorCategory').value,
        platform: $('#editorPlatform').value,
        tags: $('#editorTags').value.split('،').map(t => t.trim()).filter(Boolean),
        cover: $('#editorCover').value.trim() || null,
        excerpt: $('#editorExcerpt').value.trim(),
        score: $('#editorScore').value ? +$('#editorScore').value : null,
        editorChoice: $('#editorChoice').value === 'true',
        pinned: $('#editorPinned').value === 'true',
        status: isDraft ? 'draft' : 'published',
        authorId: u.id, authorName: u.displayName, authorAvatar: u.avatar,
        createdAt: existing ? existing.createdAt : Date.now(),
        updatedAt: Date.now(),
        edited: !!existing,
        views: existing ? (existing.views || 0) : 0,
        comments: existing ? (existing.comments || []) : []
    };

    const idx = posts.findIndex(p => p.id === data.id);
    if (idx > -1) posts[idx] = data;
    else posts.unshift(data);
    DB.setPosts(posts);

    if (!S.editingPostId) {
        addActivity('post', u.displayName + ' پست «' + title + '» رو ' + (isDraft ? 'ذخیره' : 'منتشر') + ' کرد');
        const users = DB.getUsers();
        const me = users.find(x => x.id === u.id);
        if (me) { me.xp = (me.xp || 0) + 15; me.level = Math.floor(me.xp / 100) + 1; DB.setUsers(users); S.user = me; }
    }

    toast(isDraft ? 'پیش‌نویس ذخیره شد' : (S.editingPostId ? 'ویرایش شد' : 'منتشر شد'));
    closeEditor();
    renderHome();
    if (S.page === 'post') renderPostPage(data.id);
    S.editingPostId = null;
}

function initEditor() {
    $$('.editor-toolbar button[data-cmd]').forEach(btn => {
        btn.addEventListener('click', e => {
            e.preventDefault();
            document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
            const ec = $('#editorContent');
            if (ec) ec.focus();
        });
    });

    const tImg = $('#tbImg');
    if (tImg) tImg.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => {
            try {
                const b64 = await fileToBase64(inp.files[0]);
                document.execCommand('insertImage', false, b64);
            } catch (err) { toast(err); }
        };
        inp.click();
    });

    const tCode = $('#tbCode');
    if (tCode) tCode.addEventListener('click', () => {
        const t = prompt('کد:');
        if (t) document.execCommand('insertHTML', false, '<code>' + esc(t) + '</code>');
    });

    const tSpoiler = $('#tbSpoiler');
    if (tSpoiler) tSpoiler.addEventListener('click', () => {
        const sel = window.getSelection().toString() || 'متن مخفی';
        document.execCommand('insertHTML', false, '<span class="spoiler" onclick="this.classList.toggle(\'revealed\')">' + esc(sel) + '</span>');
    });

    const tColor = $('#tbColor');
    if (tColor) tColor.addEventListener('click', () => {
        const p = $('#editorColorPicker');
        if (p) p.hidden = !p.hidden;
    });

    const cc = $('#editorColorCustom');
    if (cc) cc.addEventListener('input', () => {
        document.execCommand('foreColor', false, cc.value);
        $('#editorContent').focus();
    });

    $$('#editorColorPicker .color-dot').forEach(d => {
        d.addEventListener('click', () => {
            document.execCommand('foreColor', false, d.dataset.color);
            $('#editorContent').focus();
        });
    });

    const tCallout = $('#tbCallout');
    if (tCallout) tCallout.addEventListener('click', () => {
        const t = prompt('متن کادر مهم:');
        if (t) document.execCommand('insertHTML', false, '<div class="callout">' + esc(t) + '</div>');
    });

    const saveDraft = $('#editorDraftBtn');
    if (saveDraft) saveDraft.addEventListener('click', () => savePost(true));
    const publish = $('#editorPublishBtn');
    if (publish) publish.addEventListener('click', () => savePost(false));
    const closeBtn = $('#editorCloseBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeEditor);

    const uploadCover = $('#editorUploadCover');
    if (uploadCover) uploadCover.addEventListener('click', () => {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = async () => {
            try {
                const b64 = await fileToBase64(inp.files[0]);
                $('#editorCover').value = b64;
                toast('آپلود شد');
            } catch (err) { toast(err); }
        };
        inp.click();
    });
}

/* ═══════ Crop ═══════ */
function openCrop(file, mode, targetId) {
    const reader = new FileReader();
    reader.onload = () => {
        const img = new Image();
        img.onload = () => {
            S.cropMode = mode; S.cropTarget = targetId; S.cropImg = img;
            S.cropZoom = 1; S.cropRotate = 0;
            const z = $('#cropZoom'); const r = $('#cropRotate');
            if (z) z.value = 100;
            if (r) r.value = 0;
            drawCropCanvas();
            openModal('cropOverlay');
        };
        img.src = reader.result;
    };
    reader.readAsDataURL(file);
}

function drawCropCanvas() {
    const canvas = $('#cropCanvas');
    if (!canvas || !S.cropImg) return;
    const ctx = canvas.getContext('2d');
    const size = 300;
    canvas.width = size; canvas.height = size;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(S.cropRotate * Math.PI / 180);
    ctx.scale(S.cropZoom, S.cropZoom);
    const scale = Math.min(size / S.cropImg.width, size / S.cropImg.height);
    const w = S.cropImg.width * scale;
    const h = S.cropImg.height * scale;
    ctx.drawImage(S.cropImg, -w / 2, -h / 2, w, h);
    ctx.restore();
}

function applyCrop() {
    const canvas = $('#cropCanvas');
    if (!canvas) return;
    const isCover = S.cropMode.indexOf('cover') > -1;
    const out = document.createElement('canvas');
    out.width = isCover ? 800 : 400;
    out.height = isCover ? 300 : 400;
    const ctx = out.getContext('2d');
    if (isCover) ctx.drawImage(canvas, 0, 80, 300, 140, 0, 0, 800, 300);
    else ctx.drawImage(canvas, 0, 0, 400, 400);
    const b64 = out.toDataURL('image/jpeg', 0.85);

    if (S.cropMode === 'avatar-user' || S.cropMode === 'cover-user') {
        const users = DB.getUsers();
        const me = users.find(u => u.id === S.cropTarget);
        if (me) {
            if (S.cropMode === 'avatar-user') me.avatar = b64;
            else me.cover = b64;
            DB.setUsers(users);
            S.user = me;
            updateAuthUI();
            renderUserPanelBody('profile');
        }
    } else if (S.cropMode === 'avatar-group' || S.cropMode === 'cover-group') {
        const groups = DB.getGroups();
        const g = groups.find(x => x.id === S.cropTarget);
        if (g) {
            if (S.cropMode === 'avatar-group') g.avatar = b64;
            else g.cover = b64;
            DB.setGroups(groups);
        }
        closeModal('cropOverlay');
        renderGroupPage(S.cropTarget);
    }
    closeModal('cropOverlay');
    toast('ذخیره شد');
}

/* ═══════ Auto-approve pending ═══════ */
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

/* ═══════ Search ═══════ */
function initSearch() {
    const input = $('#searchInput');
    const results = $('#searchResults');
    if (!input || !results) return;

    input.addEventListener('input', e => {
        const q = e.target.value.trim().toLowerCase();
        if (q.length < 2) { results.innerHTML = '<p class="search-hint">شروع به تایپ کن</p>'; return; }

        const posts = DB.getPosts().filter(p => p.status === 'published' &&
            ((p.title || '').toLowerCase().indexOf(q) > -1 || stripHtml(p.content).toLowerCase().indexOf(q) > -1)).slice(0, 5);
        const users = DB.getUsers().filter(u =>
            u.username.indexOf(q) > -1 || (u.displayName || '').toLowerCase().indexOf(q) > -1).slice(0, 5);
        const groups = DB.getGroups().filter(g => g.type === 'public' &&
            (g.name || '').toLowerCase().indexOf(q) > -1).slice(0, 3);

        let html = '';
        if (posts.length) {
            html += '<div class="search-result-section">پست‌ها</div>';
            posts.forEach(p => {
                html += '<div class="search-result-item" data-open-post="' + p.id + '">' +
                    '<div class="search-result-icon">پ</div>' +
                    '<div class="search-result-info"><strong>' + esc(p.title) + '</strong>' +
                    '<small>' + faNum(p.views || 0) + ' بازدید</small></div></div>';
            });
        }
        if (users.length) {
            html += '<div class="search-result-section">کاربران</div>';
            users.forEach(u => {
                html += '<div class="search-result-item" data-open-user="' + u.id + '">' +
                    '<div class="search-result-icon">' + (u.avatar ? '<img src="' + u.avatar + '">' : u.displayName[0]) + '</div>' +
                    '<div class="search-result-info"><strong>' + esc(u.displayName) + '</strong>' +
                    '<small>@' + esc(u.username) + '</small></div></div>';
            });
        }
        if (groups.length) {
            html += '<div class="search-result-section">گروه‌ها</div>';
            groups.forEach(g => {
                html += '<div class="search-result-item" data-open-group="' + g.id + '">' +
                    '<div class="search-result-icon">' + (g.avatar ? '<img src="' + g.avatar + '">' : g.name[0]) + '</div>' +
                    '<div class="search-result-info"><strong>' + esc(g.name) + '</strong>' +
                    '<small>' + faNum((g.members || []).length) + ' عضو</small></div></div>';
            });
        }
        if (!html) html = '<p class="search-hint">نتیجه‌ای پیدا نشد</p>';
        results.innerHTML = html;

        results.querySelectorAll('[data-open-post]').forEach(el => el.addEventListener('click', () => {
            closeModal('searchOverlay'); showPage('post', el.dataset.openPost);
        }));
        results.querySelectorAll('[data-open-user]').forEach(el => el.addEventListener('click', () => {
            closeModal('searchOverlay'); showPage('profile', el.dataset.openUser);
        }));
        results.querySelectorAll('[data-open-group]').forEach(el => el.addEventListener('click', () => {
            closeModal('searchOverlay'); showPage('group', el.dataset.openGroup);
        }));
    });
}

/* ═══════ Scroll UI ═══════ */
function initScrollUI() {
    const bar = $('#scrollProgress');
    const nav = $('#navShell');
    const toTop = $('#toTop');
    let raf = null;
    window.addEventListener('scroll', () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
            const y = scrollY;
            const total = document.documentElement.scrollHeight - innerHeight;
            if (bar) bar.style.width = (total > 0 ? (y / total) * 100 : 0) + '%';
            if (nav) nav.classList.toggle('scrolled', y > 40);
            if (toTop) toTop.classList.toggle('show', y > 500);
            raf = null;
        });
    }, { passive: true });
    if (toTop) toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

/* ═══════ همه‌ی event listeners ═══════ */
function bindAllEvents() {
    /* منو */
    const menuBtn = $('#menuBtn');
    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    const drawerClose = $('#drawerClose');
    if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
    const drawerBackdrop = $('#drawerBackdrop');
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', closeDrawer);

    /* ناوبری منوی کشویی */
    document.querySelectorAll('[data-nav]').forEach(el => {
        el.addEventListener('click', e => {
            e.preventDefault();
            const page = el.dataset.nav;
            closeDrawer();
            closeUserPanel();
            showPage(page);
        });
    });

    /* تم */
    const themeBtn = $('#themeBtn');
    if (themeBtn) themeBtn.addEventListener('click', flipTheme);

    /* ورود */
    const loginBtn = $('#loginBtn');
    if (loginBtn) loginBtn.addEventListener('click', () => openModal('authOverlay'));
    const drawerLoginBtn = $('#drawerLoginBtn');
    if (drawerLoginBtn) drawerLoginBtn.addEventListener('click', () => { closeDrawer(); openModal('authOverlay'); });

    /* کاربر */
    const userBtn = $('#userBtn');
    if (userBtn) userBtn.addEventListener('click', () => openUserPanel());

    /* دکمه ساخت پست */
    const drawerNewPost = $('#drawerNewPost');
    if (drawerNewPost) drawerNewPost.addEventListener('click', () => { closeDrawer(); openEditor(); });
    const heroNewPost = $('#heroNewPost');
    if (heroNewPost) heroNewPost.addEventListener('click', () => openEditor());

    /* پنل‌ها از منو */
    const drawerAdminBtn = $('#drawerAdminBtn');
    if (drawerAdminBtn) drawerAdminBtn.addEventListener('click', () => { closeDrawer(); openAdminPanel(); });
    const drawerEditorBtn = $('#drawerEditorBtn');
    if (drawerEditorBtn) drawerEditorBtn.addEventListener('click', () => { closeDrawer(); openEditorPanel(); });
    const drawerAuthorBtn = $('#drawerAuthorBtn');
    if (drawerAuthorBtn) drawerAuthorBtn.addEventListener('click', () => { closeDrawer(); openAuthorPanel(); });

    /* جستجو */
    const searchBtn = $('#searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', () => {
        openModal('searchOverlay');
        setTimeout(() => { const si = $('#searchInput'); if (si) si.focus(); }, 250);
    });

    /* گروه جدید */
    const createGroupBtn = $('#createGroupBtn');
    if (createGroupBtn) createGroupBtn.addEventListener('click', () => {
        if (!S.user || S.user.role !== 'admin') { toast('فقط مدیر'); return; }
        openModal('newGroupOverlay');
    });

    const newGroupForm = $('#newGroupForm');
    if (newGroupForm) newGroupForm.addEventListener('submit', e => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const name = fd.get('name').trim();
        const description = fd.get('description').trim();
        const type = fd.get('type') || 'public';
        if (!name) return;
        const groups = DB.getGroups();
        const g = {
            id: uid('g_'), name, description, type,
            ownerId: S.user.id,
            members: [S.user.id], admins: [], mods: [], banned: [],
            joinRequests: [], messages: [],
            avatar: null, cover: null, createdAt: Date.now()
        };
        groups.push(g);
        DB.setGroups(groups);
        const users = DB.getUsers();
        const me = users.find(u => u.id === S.user.id);
        me.groups = me.groups || [];
        me.groups.push(g.id);
        DB.setUsers(users);
        S.user = me;
        addActivity('group', S.user.displayName + ' گروه «' + name + '» رو ساخت');
        toast('گروه ساخته شد');
        closeModal('newGroupOverlay');
        e.target.reset();
        showPage('group', g.id);
    });

    /* فیلتر پست‌ها */
    document.querySelectorAll('#postFilters .filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#postFilters .filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            S.postFilter = chip.dataset.filter;
            renderPosts();
        });
    });

    /* فیلتر زمانی */
    document.querySelectorAll('#timeFilter .time-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('#timeFilter .time-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            S.timeFilter = chip.dataset.time;
            renderTrending();
        });
    });

    /* تب‌های گروه */
    document.querySelectorAll('.group-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.group-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            S.groupFilter = tab.dataset.groupsTab;
            renderGroupsPage();
        });
    });

    /* تب‌های پنل کاربری */
    document.querySelectorAll('.up-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.up-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderUserPanelBody(tab.dataset.tab);
        });
    });

    /* تب‌های پنل مدیر */
    document.querySelectorAll('.sm-tab[data-admin-tab]').forEach(tab => {
        tab.addEventListener('click', () => renderAdminTab(tab.dataset.adminTab));
    });

    /* تب‌های پنل سردبیر */
    document.querySelectorAll('.sm-tab[data-editor-tab]').forEach(tab => {
        tab.addEventListener('click', () => renderEditorTab(tab.dataset.editorTab));
    });

    /* تب‌های پنل نویسنده */
    document.querySelectorAll('.sm-tab[data-author-tab]').forEach(tab => {
        tab.addEventListener('click', () => renderAuthorTab(tab.dataset.authorTab));
    });

    /* بستن پنل کاربری */
    const userPanelClose = $('#userPanelClose');
    if (userPanelClose) userPanelClose.addEventListener('click', closeUserPanel);

    /* کلیک روی backdrop و دکمه‌های close */
    document.addEventListener('click', e => {
        const closeBtn = e.target.closest('[data-close]');
        if (closeBtn) {
            const target = closeBtn.dataset.close;
            if (target === 'auth') closeModal('authOverlay');
            else if (target === 'newGroup') closeModal('newGroupOverlay');
            else if (target === 'groupSettings') closeModal('groupSettingsOverlay');
            else if (target === 'search') closeModal('searchOverlay');
            else if (target === 'crop') closeModal('cropOverlay');
            else if (target === 'admin') { const p = $('#adminPanel'); if (p) p.hidden = true; }
            else if (target === 'editor-panel') { const p = $('#editorPanel'); if (p) p.hidden = true; }
            else if (target === 'author-panel') { const p = $('#authorPanel'); if (p) p.hidden = true; }
        }
    });

    /* رویدادهای پنل مدیر/سردبیر/نویسنده (event delegation) */
    document.addEventListener('click', e => {
        const roleSel = e.target.closest('[data-role]');
        if (roleSel) {
            const users = DB.getUsers();
            const u = users.find(x => x.id === roleSel.dataset.role);
            if (u) { u.role = roleSel.value; DB.setUsers(users); toast('نقش تغییر کرد'); }
        }

        const tickBlue = e.target.closest('[data-tick-blue]');
        if (tickBlue) {
            const users = DB.getUsers();
            const u = users.find(x => x.id === tickBlue.dataset.tickBlue);
            if (u) { u.tick = 'blue'; DB.setUsers(users); toast('تیک آبی داده شد'); renderAdminTab(S.adminTab); }
        }

        const tickGold = e.target.closest('[data-tick-gold]');
        if (tickGold) {
            const users = DB.getUsers();
            const u = users.find(x => x.id === tickGold.dataset.tickGold);
            if (u) { u.tick = 'gold'; DB.setUsers(users); toast('تیک طلایی داده شد'); renderAdminTab(S.adminTab); }
        }

        const tickNone = e.target.closest('[data-tick-none]');
        if (tickNone) {
            const users = DB.getUsers();
            const u = users.find(x => x.id === tickNone.dataset.tickNone);
            if (u) { u.tick = null; DB.setUsers(users); toast('تیک حذف شد'); renderAdminTab(S.adminTab); }
        }

        const delUser = e.target.closest('[data-delete-user]');
        if (delUser) {
            if (!confirm('حذف بشه؟')) return;
            DB.setUsers(DB.getUsers().filter(x => x.id !== delUser.dataset.deleteUser));
            toast('حذف شد');
            renderAdminTab(S.adminTab);
        }

        const editPost = e.target.closest('[data-edit-post]');
        if (editPost) { closeAllModals(); openEditor(editPost.dataset.editPost); }

        const delPost = e.target.closest('[data-delete-post]');
        if (delPost) {
            if (!confirm('پست حذف بشه؟')) return;
            DB.setPosts(DB.getPosts().filter(p => p.id !== delPost.dataset.deletePost));
            toast('حذف شد');
            renderAdminTab(S.adminTab);
        }

        const featurePost = e.target.closest('[data-feature-post]');
        if (featurePost) {
            const posts = DB.getPosts();
            const p = posts.find(x => x.id === featurePost.dataset.featurePost);
            if (p) { p.editorChoice = !p.editorChoice; DB.setPosts(posts); toast('تغییر کرد'); renderEditorTab('featured'); }
        }

        const approveC = e.target.closest('[data-approve-comment]');
        if (approveC) {
            const pending = DB.getPending();
            const item = pending.find(x => x.comment.id === approveC.dataset.approveComment);
            if (item) {
                const posts = DB.getPosts();
                const post = posts.find(p => p.id === item.postId);
                if (post) {
                    post.comments = post.comments || [];
                    item.comment.status = 'approved';
                    post.comments.push(item.comment);
                    DB.setPosts(posts);
                }
                DB.setPending(pending.filter(x => x.comment.id !== item.comment.id));
                toast('تأیید شد');
                renderAdminTab(S.adminTab);
            }
        }

        const rejectC = e.target.closest('[data-reject-comment]');
        if (rejectC) {
            DB.setPending(DB.getPending().filter(x => x.comment.id !== rejectC.dataset.rejectComment));
            toast('رد شد');
            renderAdminTab(S.adminTab);
        }

        const delGroup = e.target.closest('[data-delete-group]');
        if (delGroup) {
            if (!confirm('گروه حذف بشه؟')) return;
            DB.setGroups(DB.getGroups().filter(g => g.id !== delGroup.dataset.deleteGroup));
            toast('گروه حذف شد');
            renderAdminTab(S.adminTab);
        }

        const viewGroup = e.target.closest('[data-view-group]');
        if (viewGroup) { const p = $('#adminPanel'); if (p) p.hidden = true; showPage('group', viewGroup.dataset.viewGroup); }
    });

    /* بستن با Escape */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeAllModals();
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); openModal('searchOverlay'); }
    });

    /* Crop sliders */
    const cropZoom = $('#cropZoom');
    if (cropZoom) cropZoom.addEventListener('input', e => {
        S.cropZoom = +e.target.value / 100;
        drawCropCanvas();
    });
    const cropRotate = $('#cropRotate');
    if (cropRotate) cropRotate.addEventListener('input', e => {
        S.cropRotate = +e.target.value;
        drawCropCanvas();
    });
    const cropCancel = $('#cropCancel');
    if (cropCancel) cropCancel.addEventListener('click', () => closeModal('cropOverlay'));
    const cropApply = $('#cropApply');
    if (cropApply) cropApply.addEventListener('click', applyCrop);

    /* Export/Import backup */
    document.addEventListener('click', e => {
        if (e.target.id === 'exportDataBtn') {
            const data = { users: DB.getUsers(), posts: DB.getPosts(), groups: DB.getGroups(),
                messages: DB.getMessages(), notifs: DB.getNotifs(), activity: DB.getActivity(),
                blocks: DB.getBlocks(), pending: DB.getPending(), exportedAt: Date.now() };
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'nova-backup-' + Date.now() + '.json';
            a.click(); URL.revokeObjectURL(url);
            toast('دانلود شد');
        }
        if (e.target.id === 'importDataBtn') {
            const inp = $('#importDataInput'); if (inp) inp.click();
        }
    });

    const importInput = document.getElementById('importDataInput');
    if (importInput) importInput.addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (data.users) DB.setUsers(data.users);
                if (data.posts) DB.setPosts(data.posts);
                if (data.groups) DB.setGroups(data.groups);
                if (data.messages) DB.setMessages(data.messages);
                if (data.notifs) DB.setNotifs(data.notifs);
                if (data.activity) DB.setActivity(data.activity);
                if (data.blocks) DB.setBlocks(data.blocks);
                if (data.pending) DB.setPending(data.pending);
                toast('بازیابی شد');
                renderAdminTab(S.adminTab);
                renderHome();
            } catch (err) { toast('فایل نامعتبر'); }
        };
        reader.readAsText(f);
    });
}

/* ═══════ Boot ═══════ */
function boot() {
    console.log('نووا گیم در حال بارگذاری...');

    applyTheme(S.theme);
    document.documentElement.dataset.perf = 'high';

    S.user = getCurrentUser();
    updateAuthUI();

    initScrollUI();
    initAuth();
    initSearch();
    initEditor();
    bindAllEvents();

    renderHome();

    setInterval(checkPendingAutoApprove, 60000);

    console.log('میانبر: Ctrl+K برای جستجو');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
