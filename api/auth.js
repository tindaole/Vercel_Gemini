// api/auth.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password } = req.body;
    const envPassword = process.env.APP_PASSWORD || process.env.SITE_PASSWORD;

    if (!envPassword) {
        return res.status(500).json({ 
            error: 'Chưa thiết lập APP_PASSWORD trong Vercel Environment Variables. Vui lòng vào Vercel Project Settings -> Environment Variables để đặt APP_PASSWORD.' 
        });
    }

    if (password === envPassword) {
        // Session duration: 15 minutes (15 * 60 * 1000 ms)
        const expiresInMs = 15 * 60 * 1000;
        const expiresAt = Date.now() + expiresInMs;
        
        return res.status(200).json({ 
            success: true, 
            message: 'Xác thực thành công!', 
            expiresAt: expiresAt,
            expiresInSeconds: 900
        });
    } else {
        return res.status(401).json({ error: 'Mật khẩu không đúng! Vui lòng thử lại.' });
    }
}
