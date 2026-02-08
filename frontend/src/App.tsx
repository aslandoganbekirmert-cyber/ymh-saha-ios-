import { useState, useRef, useEffect } from 'react';
import { Camera, CheckCircle, X, Loader2, Truck, Box, Scale } from 'lucide-react';
import './App.css';

// --- TİPLER ---
interface WaybillData {
    id: string;
    plateNumber: string;
    materialType: string;
    quantity: string;
    unit: string;
    supplierName: string;
    ticketNumber: string;
    photoUrl?: string;
    date?: string;
}

// --- MOCK DATA ---
const INITIAL_DATA: WaybillData[] = [
    { id: '1', plateNumber: '34 BNU 389', materialType: 'LIDER KUMLAMA', quantity: '47100', unit: 'KG', supplierName: '24-LIDER KUMLAMA', ticketNumber: '12220', date: '2026-02-06' },
    { id: '2', plateNumber: '43 AAD 051', materialType: 'AYD KLAVUZ TUGLA', quantity: '4320', unit: 'ADET', supplierName: '2K PROJE', ticketNumber: '9', date: '2026-02-04' },
];

function App() {
    const [view, setView] = useState<'DASHBOARD' | 'PROCESSING' | 'REVIEW'>('DASHBOARD');
    const [transactions, setTransactions] = useState<WaybillData[]>(INITIAL_DATA);
    const [currentData, setCurrentData] = useState<WaybillData | null>(null);
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleCameraOpen = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedImage(file);
            const objectUrl = URL.createObjectURL(file);
            setPreviewUrl(objectUrl);
            setView('PROCESSING');

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('project_id', 'MOBILE_APP_FINAL');

                // LOCALHOST DEĞİL, IP ADRESİ OLMALI (Native App İçin)
                // Ancak şimdilik build alırken geliştirme ortamı için localhost bırakıyoruz
                // Gerçek cihazda test ederken IP adresi gerekecek
                const response = await fetch('http://localhost:3000/api/v1/transactions', {
                    method: 'POST',
                    body: formData,
                });

                if (!response.ok) throw new Error('Sunucu Hatası');

                const result = await response.json();
                const extracted = result.ocr_data?.extracted || {};

                const newData: WaybillData = {
                    id: result.id,
                    plateNumber: extracted.plateNumber || '',
                    materialType: extracted.materialType || '',
                    quantity: extracted.quantity || '',
                    unit: extracted.unit || 'TON',
                    supplierName: extracted.supplierName || '',
                    ticketNumber: extracted.ticketNumber || '',
                    date: new Date().toISOString().split('T')[0],
                    photoUrl: objectUrl
                };

                setCurrentData(newData);
                setView('REVIEW');

            } catch (error) {
                console.error("Upload failed", error);
                alert("Fiş okunamadı! Lütfen tekrar deneyin.");
                setView('DASHBOARD');
            }
        }
    };

    const handleSave = () => {
        if (currentData) {
            setTransactions([currentData, ...transactions]);
            setView('DASHBOARD');
            setCurrentData(null);
            setSelectedImage(null);
            setPreviewUrl(null);
        }
    };

    return (
        <div className="app-container">

            {/* 1. DASHBOARD VIEW */}
            {view === 'DASHBOARD' && (
                <>
                    <header className="header">
                        <div className="logo-container">
                            {/* KULLANICI LOGOSU (beyaz daireli yeni versiyon) */}
                            <img src="/logo.png" alt="YMH" style={{ height: '50px', marginLeft: '-5px' }} />
                        </div>
                        <div className="badge">TR</div>
                    </header>

                    <main className="main-content">
                        <h2 className="section-title">Son Hareketler</h2>

                        {transactions.map((tx) => (
                            <div key={tx.id} className="card">
                                <div className="card-header">
                                    <div className="plate-badge">
                                        <Truck size={18} color="#FFD600" />
                                        <span>{tx.plateNumber || 'PLAKA YOK'}</span>
                                    </div>
                                    <span className="date-text">{tx.date}</span>
                                </div>

                                <div className="card-grid">
                                    <div className="info-box">
                                        <div className="info-label">
                                            <Box size={10} /> Malzeme
                                        </div>
                                        <div className="info-value">{tx.materialType || '-'}</div>
                                    </div>
                                    <div className="info-box">
                                        <div className="info-label">
                                            <Scale size={10} /> Miktar
                                        </div>
                                        <div className="info-value highlight">{tx.quantity} <span className="unit">{tx.unit}</span></div>
                                    </div>
                                </div>

                                <div className="card-footer">
                                    <span className="supplier-text">{tx.supplierName}#{tx.ticketNumber}</span>
                                </div>
                            </div>
                        ))}
                    </main>

                    <div className="bottom-bar">
                        <input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            ref={fileInputRef}
                            className="hidden"
                            onChange={handleFileChange}
                        />
                        <button onClick={handleCameraOpen} className="btn btn-primary full-width">
                            <Camera size={24} />
                            Fiş Okut
                        </button>
                    </div>
                </>
            )}

            {/* 2. PROCESSING VIEW */}
            {view === 'PROCESSING' && (
                <div className="loading-overlay">
                    <div className="spinner"></div>
                    <h2 className="loading-text">Analiz Ediliyor...</h2>
                    <p className="loading-sub">Yapay Zeka Fişi Okuyor</p>
                </div>
            )}

            {/* 3. REVIEW VIEW */}
            {view === 'REVIEW' && currentData && (
                <>
                    <header className="header">
                        <div className="logo-container">
                            <span className="logo-text">Doğrulama</span>
                        </div>
                        <button onClick={() => setView('DASHBOARD')} className="close-btn">
                            <X size={24} color="#666" />
                        </button>
                    </header>

                    <main className="main-content">
                        {previewUrl && (
                            <img src={previewUrl} className="preview-img" alt="Receipt" />
                        )}

                        <div className="forms">

                            <div className="form-group">
                                <label className="label">PLAKA</label>
                                <input
                                    type="text"
                                    value={currentData.plateNumber}
                                    onChange={(e) => setCurrentData({ ...currentData, plateNumber: e.target.value })}
                                    className="input input-plate"
                                />
                            </div>

                            <div className="form-group flex-row">
                                <div className="full-width">
                                    <label className="label">MİKTAR</label>
                                    <input
                                        type="text"
                                        value={currentData.quantity}
                                        onChange={(e) => setCurrentData({ ...currentData, quantity: e.target.value })}
                                        className="input highlight"
                                    />
                                </div>

                                <div style={{ width: '80px' }}>
                                    <label className="label">BİRİM</label>
                                    <select
                                        value={currentData.unit}
                                        onChange={(e) => setCurrentData({ ...currentData, unit: e.target.value })}
                                        className="input"
                                    >
                                        <option>KG</option>
                                        <option>TON</option>
                                        <option>ADET</option>
                                        <option>M3</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="label">MALZEME CİNSİ</label>
                                <input
                                    type="text"
                                    value={currentData.materialType}
                                    onChange={(e) => setCurrentData({ ...currentData, materialType: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">TEDARİKÇİ</label>
                                <input
                                    type="text"
                                    value={currentData.supplierName}
                                    onChange={(e) => setCurrentData({ ...currentData, supplierName: e.target.value })}
                                    className="input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="label">FİŞ NO</label>
                                <input
                                    type="text"
                                    value={currentData.ticketNumber}
                                    onChange={(e) => setCurrentData({ ...currentData, ticketNumber: e.target.value })}
                                    className="input"
                                />
                            </div>

                        </div>
                    </main>

                    <div className="bottom-bar">
                        <button onClick={() => setView('DASHBOARD')} className="btn btn-secondary">
                            İptal
                        </button>
                        <button onClick={handleSave} className="btn btn-primary full-width">
                            <CheckCircle size={24} />
                            KAYDET
                        </button>
                    </div>
                </>
            )}

        </div>
    );
}

export default App;
