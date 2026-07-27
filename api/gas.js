// api/gas.js
export default async function handler(req, res) {
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
                body: JSON.stringify(req.body)
            });
        } else {
            // Forward GET request with query params
            const queryParams = new URLSearchParams(req.query);
            const separator = gasUrl.includes('?') ? '&' : '?';
            const urlWithParams = `${gasUrl}${separator}${queryParams.toString()}`;
            response = await fetch(urlWithParams, {
                method: 'GET'
            });
        }

        const data = await response.json();
        res.status(200).json(data);
    } catch (error) {
        console.error("Lỗi khi kết nối với Google Apps Script:", error);
        res.status(500).json({ error: 'Không thể kết nối tới Google Apps Script: ' + error.message });
    }
}
