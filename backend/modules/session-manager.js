const sessions = {};

function createSession(videoId, proxy) {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    sessions[id] = {
        videoId,
        proxy,
        userAgent: getRandomUserAgent(),
        createdAt: Date.now()
    };
    return id;
}

function getSession(id) {
    return sessions[id];
}

function deleteSession(id) {
    delete sessions[id];
}

function getRandomUserAgent() {
    const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36'
    ];
    return userAgents[Math.floor(Math.random() * userAgents.length)];
}

module.exports = { createSession, getSession, deleteSession };