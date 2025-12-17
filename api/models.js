// api/models.js
export default async function handler(req, res) {
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
        return res.status(500).json({ error: 'Chưa cấu hình API Key' });
    }

    try {
        // Gọi API ListModels của Google
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
            { method: 'GET' }
        );
        
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error?.message || 'Không lấy được danh sách model');
        }

        // Trả về danh sách model cho Frontend
        res.status(200).json(data);

    } catch (error) {
        console.error("Lỗi lấy model:", error);
        res.status(500).json({ error: error.message });
    }
}