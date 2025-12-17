// api/chat.js
export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Nhận thêm tham số 'model' từ frontend gửi lên
    const { prompt, model } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    // Nếu người dùng chưa chọn, mặc định thử dùng gemini-1.5-flash
    const selectedModel = model || "models/gemini-2.5-flash";

    if (!apiKey) return res.status(500).json({ error: 'Missing API Key' });
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/${selectedModel}:generateContent?key=${apiKey}`;
    try {
        // Cấu trúc URL động theo model được chọn
        // Lưu ý: selectedModel sẽ có dạng "models/gemini-pro" nên ta ghép trực tiếp vào URL

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });
        console.log(response)
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Lỗi từ Google API');
        }

        const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Không có phản hồi text.";
        res.status(200).json({ result: textResponse });

    } catch (error) {
        console.log(apiUrl);
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}