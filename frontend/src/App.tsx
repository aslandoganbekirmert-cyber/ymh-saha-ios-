
import React, { useState, useEffect } from 'react';
import './Style.css';
import { Camera, CameraResultType } from '@capacitor/camera';
import { Geolocation } from '@capacitor/geolocation';
import {
    Plus,
    Camera as CameraIcon,
    ArrowLeft,
    Truck,
    LogOut,
    CheckCircle,
    AlertTriangle,
    X,
    Building2,
    FileText,
    MapPin,
    Calendar,
    Settings
} from 'lucide-react';

/* --- AYARLAR --- */
// Proxy üzerinden gideceği için sadece /api yeterli
const API_URL = '/api';

/* --- TİPLER --- */
interface Project {
    id: string;
    name: string;
    location: string;
}

interface Transaction {
    id: string;
    plate_no: string;
    company?: string;
    invoice_no?: string;
    material: string;
    quantity: number;
    unit: string;
    notes?: string;
    image_url?: string;
    created_at?: string;
}

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'auth' | 'dashboard' | 'camera' | 'new-site'>('auth');
    const [loading, setLoading] = useState(false);

    // Veriler
    const [projects, setProjects] = useState<Project[]>([]);
    const [activeProject, setActiveProject] = useState<Project | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);

    // Formlar
    const [newSiteName, setNewSiteName] = useState('');

    // DETAYLI İRSALİYE FORMU
    const [wbForm, setWbForm] = useState({
        plate: '',
        company: '',
        invoice_no: '',
        material: 'Hazır Beton C30',
        qty: '',
        unit: 'Ton',
        notes: '',
        imgBlob: null as Blob | null,
        imgPreview: ''
    });

    /* --- BAŞLANGIÇ --- */
    useEffect(() => {
        loadProjects();
    }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects`);
            if (res.ok) {
                const data = await res.json();
                setProjects(data);

                // Son oturumu kontrol et
                const lastId = localStorage.getItem('last_site_id');
                if (lastId) {
                    const saved = data.find((p: Project) => p.id === lastId);
                    if (saved) openDashboard(saved);
                }
            } else {
                console.error('API Hatası:', res.status);
            }
        } catch (e) {
            console.error('Bağlantı Hatası:', e);
        } finally {
            setLoading(false);
        }
    };

    /* --- İŞLEMLER --- */
    const openDashboard = async (p: Project) => {
        setActiveProject(p);
        localStorage.setItem('last_site_id', p.id);
        setView('dashboard');

        // Verileri Yükle
        try {
            const res = await fetch(`${API_URL}/transactions?project_id=${p.id}`);
            if (res.ok) setTransactions(await res.json());
        } catch (e) { console.error(e); }
    };

    const createSite = async () => {
        if (!newSiteName) return alert('Şantiye adı giriniz.');
        setLoading(true);

        try {
            // Konum
            let lat = 0, lng = 0;
            try {
                const pos = await Geolocation.getCurrentPosition();
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
            } catch (e) { console.log('GPS alınamadı'); }

            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newSiteName, location: 'Konum Alındı', gps_lat: lat, gps_lng: lng })
            });

            if (res.ok) {
                const newP = await res.json();
                setProjects([...projects, newP]);
                setView('auth');
                setNewSiteName('');
                openDashboard(newP);
            } else {
                alert('Sunucu hatası. Kayıt yapılamadı.');
            }
        } catch (e) {
            alert('Bağlantı hatası.');
        } finally {
            setLoading(false);
        }
    };

    const takePhoto = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 70,
                allowEditing: false,
                resultType: CameraResultType.Uri,
                saveToGallery: false // Galeriye kaydetme, sadece geçici
            });

            // Blob'a çevir
            const response = await fetch(image.webPath!);
            const blob = await response.blob();

            setWbForm(prev => ({ ...prev, imgBlob: blob, imgPreview: image.webPath! }));
        } catch (e) {
            console.log('Kamera iptal edildi');
        }
    };

    const removePhoto = () => {
        setWbForm(prev => ({ ...prev, imgBlob: null, imgPreview: '' }));
    };

    const saveWaybill = async () => {
        if (!activeProject) return;
        if (!wbForm.qty && !wbForm.imgBlob) return alert('En azından Miktar girin veya Fotoğraf ekleyin.');

        setLoading(true);
        try {
            const formData = new FormData();
            formData.append('project_id', activeProject.id);

            // Tüm alanları ekle
            formData.append('plate_no', wbForm.plate || 'PLAKA YOK');
            formData.append('company', wbForm.company || '');
            formData.append('invoice_no', wbForm.invoice_no || '');
            formData.append('material', wbForm.material);
            formData.append('quantity', wbForm.qty || '0');
            formData.append('unit', wbForm.unit);
            formData.append('notes', wbForm.notes || '');

            if (wbForm.imgBlob) {
                formData.append('file', wbForm.imgBlob, 'photo.jpg');
            }

            // Konum Ekle
            try {
                const pos = await Geolocation.getCurrentPosition();
                formData.append('gps_lat', String(pos.coords.latitude));
                formData.append('gps_lng', String(pos.coords.longitude));
            } catch (e) { }

            const res = await fetch(`${API_URL}/transactions`, {
                method: 'POST',
                body: formData
            });

            if (res.ok) {
                const newTx = await res.json();
                setTransactions([newTx, ...transactions]);
                setView('dashboard');
                // Formu Sıfırla
                setWbForm({
                    plate: '', company: '', invoice_no: '',
                    material: 'Hazır Beton C30', qty: '', unit: 'Ton',
                    notes: '', imgBlob: null, imgPreview: ''
                });
            } else {
                alert('Sunucu kayıt etmedi. Tekrar deneyin.');
            }

        } catch (e) {
            alert('Gönderim sırasında hata oluştu.');
        } finally {
            setLoading(false);
        }
    };

    /* --- EKRANLAR --- */

    // 1. ŞANTİYE SEÇİMİ
    if (view === 'auth') return (
        <div id="root">
            <div className="header-bar" style={{ justifyContent: 'center' }}>
                <img src="/logo.png" className="brand-logo" alt="YMH" />
            </div>

            <div className="content-scroll">
                <div className="form-label" style={{ marginBottom: 16 }}>ŞANTİYE SEÇİMİ</div>

                {loading && <div style={{ textAlign: 'center', padding: 20 }}>Yükleniyor...</div>}
                {!loading && projects.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Kayıtlı şantiye yok.</div>}

                {projects.map(p => (
                    <button key={p.id} className="btn-action btn-secondary" style={{ marginBottom: 12, justifyContent: 'space-between', padding: '0 20px', textTransform: 'none' }} onClick={() => openDashboard(p)}>
                        <span style={{ fontWeight: 700 }}>{p.name}</span>
                        <Truck size={20} color="#000" />
                    </button>
                ))}

                <div style={{ padding: 20 }}></div>
                <button className="btn-action" onClick={() => setView('new-site')}>
                    <Plus size={24} /> YENİ ŞANTİYE
                </button>
            </div>
        </div>
    );

    // 2. YENİ ŞANTİYE
    if (view === 'new-site') return (
        <div className="modal-layer">
            <div className="modal-header">
                <h3>YENİ ŞANTİYE</h3>
                <div onClick={() => setView('auth')} style={{ padding: 10 }}>İPTAL</div>
            </div>
            <div style={{ padding: 20 }}>
                <div className="form-group">
                    <label className="form-label">PROJE ADI</label>
                    <input className="form-input" placeholder="ÖRN: MERKEZ DEPO" value={newSiteName} onChange={e => setNewSiteName(e.target.value)} autoFocus />
                </div>
                <div style={{ fontSize: 13, color: '#666', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={16} /> Konum otomatik alınacaktır.
                </div>
                <button className="btn-action" onClick={createSite} disabled={loading}>
                    {loading ? 'KAYDEDİLİYOR...' : 'BAŞLAT'}
                </button>
            </div>
        </div>
    );

    // 3. DASHBOARD
    if (view === 'dashboard') {
        const totalTon = transactions.reduce((acc, t) => acc + Number(t.quantity || 0), 0);

        return (
            <div id="root">
                <div className="header-bar">
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" className="brand-logo" alt="YMH" style={{ height: 32, marginRight: 12 }} />
                        <div style={{ fontWeight: 800, fontSize: 16 }}>{activeProject?.name}</div>
                    </div>
                    <div onClick={() => { localStorage.removeItem('last_site_id'); setView('auth'); }}>
                        <LogOut size={24} color="#000" />
                    </div>
                </div>

                <div className="content-scroll">
                    <div className="stat-row">
                        <div className="stat-item">
                            <div className="stat-val">{transactions.length}</div>
                            <div className="stat-tag">SEFER</div>
                        </div>
                        <div className="stat-item" style={{ background: '#FFD600', borderColor: '#E5C300' }}>
                            <div className="stat-val">{totalTon}</div>
                            <div className="stat-tag" style={{ color: '#000' }}>TOPLAM MİKTAR</div>
                        </div>
                    </div>

                    <button className="btn-action" style={{ marginBottom: 24 }} onClick={() => setView('camera')}>
                        <Plus /> YENİ GİRİŞ EKLE
                    </button>

                    <div className="form-label">SON HAREKETLER</div>
                    {transactions.map(t => (
                        <div key={t.id} className="info-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                {t.image_url ? <CheckCircle size={20} color="#10b981" /> : <AlertTriangle size={20} color="#f59e0b" />}
                                <div>
                                    <div style={{ fontWeight: 800, fontSize: 16 }}>{t.plate_no || 'PLAKA YOK'}</div>
                                    <div style={{ fontSize: 12, color: '#666' }}>{t.material}</div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 800, fontSize: 18 }}>
                                    {t.quantity} <span style={{ fontSize: 12 }}>{t.unit}</span>
                                </div>
                                <div style={{ fontSize: 11, color: '#999' }}>{t.created_at?.split('T')[0]}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    // 4. DETAYLI GİRİŞ FORMU
    if (view === 'camera') return (
        <div className="modal-layer" style={{ overflowY: 'auto' }}>
            <div className="modal-header" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <div style={{ fontWeight: 800 }}>YENİ İRSALİYE</div>
                <div onClick={() => setView('dashboard')} style={{ padding: 10 }}><ArrowLeft /></div>
            </div>

            <div className="content-scroll">
                {/* KAMERA BÖLÜMÜ */}
                <div className={`camera-trigger ${wbForm.imgPreview ? 'filled' : ''}`} onClick={wbForm.imgPreview ? undefined : takePhoto}>
                    {wbForm.imgPreview ? (
                        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                            <img src={wbForm.imgPreview} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
                            <div onClick={removePhoto} style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', padding: 8, borderRadius: 20 }}>
                                <X size={20} />
                            </div>
                        </div>
                    ) : (
                        <>
                            <CameraIcon size={48} style={{ marginBottom: 8 }} />
                            <div style={{ fontWeight: 700 }}>FOTOĞRAF ÇEK</div>
                            <div style={{ fontSize: 12 }}>OCR İLE OKUNACAK</div>
                        </>
                    )}
                </div>

                {/* DETAYLI FORM */}
                <div className="stat-row">
                    <div className="form-group">
                        <label className="form-label">İRSALİYE NO</label>
                        <input className="form-input" placeholder="123456" value={wbForm.invoice_no} onChange={e => setWbForm({ ...wbForm, invoice_no: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">PLAKA</label>
                        <input className="form-input" placeholder="35 ABC 12" value={wbForm.plate} onChange={e => setWbForm({ ...wbForm, plate: e.target.value.toUpperCase() })} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">FİRMA ADI</label>
                    <div style={{ position: 'relative' }}>
                        <Building2 size={20} style={{ position: 'absolute', left: 16, top: 18, color: '#999' }} />
                        <input className="form-input" style={{ paddingLeft: 48 }} placeholder="Tedarikçi Firma" value={wbForm.company} onChange={e => setWbForm({ ...wbForm, company: e.target.value })} />
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">MALZEME</label>
                    <select className="form-input" value={wbForm.material} onChange={e => setWbForm({ ...wbForm, material: e.target.value })}>
                        {['Hazır Beton C30', 'Demir Ø12', 'İnce Kum', 'Çimento', 'Tuğla', 'Agrega', 'Kalıp', 'Diğer'].map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>

                <div className="stat-row">
                    <div className="form-group">
                        <label className="form-label">MİKTAR</label>
                        <input type="number" className="form-input" placeholder="0" value={wbForm.qty} onChange={e => setWbForm({ ...wbForm, qty: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">BİRİM</label>
                        <select className="form-input" value={wbForm.unit} onChange={e => setWbForm({ ...wbForm, unit: e.target.value })}>
                            {['Ton', 'm³', 'Adet', 'Sefer', 'Kg', 'Torba'].map(u => (
                                <option key={u} value={u}>{u}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">AÇIKLAMA (OPSİYONEL)</label>
                    <textarea
                        className="form-input"
                        style={{ height: 80, resize: 'none', paddingTop: 12 }}
                        placeholder="Notlar..."
                        value={wbForm.notes}
                        onChange={e => setWbForm({ ...wbForm, notes: e.target.value })}
                    />
                </div>

                <button className="btn-action" onClick={saveWaybill} disabled={loading} style={{ marginBottom: 40 }}>
                    {loading ? 'KAYDEDİLİYOR...' : 'KAYDET VE GÖNDER'}
                </button>
            </div>
        </div>
    );
}
