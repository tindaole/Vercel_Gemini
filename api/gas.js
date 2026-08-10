// api/gas.js
export default async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const gasUrl = process.env.GAS_URL;

    if (!gasUrl) {
        return res.status(500).json({ 
            error: 'Chưa cấu hình GAS_URL trong Vercel Environment Variables. Vui lòng thêm GAS_URL trong Vercel Project Settings -> Environment Variables.' 
        });
    }

    try {
        let response;
        if (req.method === 'POST') {
            response = await fetch(gasUrl, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json' 
                },
                body: JSON.stringify(req.body),
                redirect: 'follow'
            });
        } else {
            // Forward GET request with query params
            const queryParams = new URLSearchParams(req.query);
            const separator = gasUrl.includes('?') ? '&' : '?';
            const urlWithParams = `${gasUrl}${separator}${queryParams.toString()}`;
            response = await fetch(urlWithParams, {
                method: 'GET',
                redirect: 'follow'
            });
        }

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (parseErr) {
            console.error("Non-JSON response from Google Apps Script:", text);
            return res.status(502).json({ error: 'Phản hồi không hợp lệ từ Google Apps Script: ' + text.substring(0, 200) });
        }

        res.status(200).json(data);
    } catch (error) {
        console.error("Lỗi khi kết nối với Google Apps Script:", error);
        res.status(500).json({ error: 'Không thể kết nối tới Google Apps Script: ' + error.message });
    }
}
