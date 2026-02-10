
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
    MapPin,
    Calendar,
    Settings,
    MoreHorizontal,
    FileText,
    ChevronRight,
    Search,
    Loader2
} from 'lucide-react';

const API_URL = '/api/v1';

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'auth' | 'dashboard' | 'form' | 'new-site'>('auth');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // Data
    const [projects, setProjects] = useState<any[]>([]);
    const [activeProject, setActiveProject] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);

    // Form States
    const [newSiteName, setNewSiteName] = useState('');
    const [wbForm, setWbForm] = useState({
        plate: '', company: '', invoice_no: '', material: 'HAFRİYAT',
        qty: '', unit: 'Sefer', notes: '', imgBlob: null as Blob | null, imgPreview: ''
    });

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 3000);
    };

    /* --- INIT --- */
    useEffect(() => { loadProjects(); }, []);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}/projects`);
            if (res.ok) {
                const data = await res.json();
                setProjects(data);
                const lastId = localStorage.getItem('last_site_id');
                if (lastId) {
                    const saved = data.find((p: any) => p.id === lastId);
                    if (saved) openDashboard(saved);
                }
            }
        } catch (e) { console.log('Bağlantı hatası', e); }
        finally { setLoading(false); }
    };

    const createSite = async () => {
        if (!newSiteName) return showToast('Saha Adı Giriniz', 'error');
        setLoading(true);
        try {
            let lat = 0, lng = 0;
            try {
                const pos = await Geolocation.getCurrentPosition();
                lat = pos.coords.latitude; lng = pos.coords.longitude;
            } catch { }

            const payload = {
                name: newSiteName,
                code: `SAHA-${Date.now().toString().slice(-4)}`,
                city: 'İzmir',
                district: 'Merkez',
                status: 'ACTIVE',
                gps_lat: lat,
                gps_lng: lng
            };

            const res = await fetch(`${API_URL}/projects`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const newP = await res.json();
                setProjects([...projects, newP]);
                setView('auth');
                setNewSiteName('');
                showToast('Saha Oluşturuldu');
                openDashboard(newP);
            } else {
                showToast('Oluşturulamadı', 'error');
            }
        } catch { showToast('Sunucu Hatası', 'error'); }
        finally { setLoading(false); }
    };

    const openDashboard = async (p: any) => {
        setActiveProject(p);
        localStorage.setItem('last_site_id', p.id);
        setView('dashboard');
        try {
            const res = await fetch(`${API_URL}/transactions?project_id=${p.id}`);
            if (res.ok) setTransactions(await res.json());
        } catch { }
    };

    const takePhoto = async () => {
        try {
            const image = await Camera.getPhoto({
                quality: 60, allowEditing: false, resultType: CameraResultType.Uri,
                saveToGallery: false
            });
            const response = await fetch(image.webPath!);
            const blob = await response.blob();
            setWbForm(prev => ({ ...prev, imgBlob: blob, imgPreview: image.webPath! }));
        } catch { }
    };

    const saveWaybill = async () => {
        if (!activeProject) return;
        setLoading(true);
        try {
            const fd = new FormData();
            fd.append('project_id', activeProject.id);
            fd.append('plate_no', wbForm.plate || 'PLAKA YOK');
            fd.append('company', wbForm.company || '');
            fd.append('invoice_no', wbForm.invoice_no || '');
            fd.append('material', wbForm.material);
            fd.append('quantity', wbForm.qty || '0');
            fd.append('unit', wbForm.unit);
            fd.append('notes', wbForm.notes || '');
            if (wbForm.imgBlob) fd.append('file', wbForm.imgBlob, 'photo.jpg');

            try {
                const pos = await Geolocation.getCurrentPosition();
                fd.append('gps_lat', String(pos.coords.latitude));
                fd.append('gps_lng', String(pos.coords.longitude));
            } catch { }

            const res = await fetch(`${API_URL}/transactions`, { method: 'POST', body: fd });
            if (res.ok) {
                const newTx = await res.json();
                setTransactions([newTx, ...transactions]);
                setView('dashboard');
                setWbForm({
                    plate: '', company: '', invoice_no: '', material: 'HAFRİYAT',
                    qty: '', unit: 'Sefer', notes: '', imgBlob: null, imgPreview: ''
                });
                showToast('Kayıt Başarılı!');
            } else showToast('Hata Oluştu', 'error');
        } catch { showToast('Bağlantı Hatası', 'error'); }
        finally { setLoading(false); }
    };

    /* --- VIEWS --- */

    // 1. SAHA LISTESI
    if (view === 'auth') return (
        <div id="root" style={{ background: '#fff', padding: 24, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: 40 }}>
                <img src="/logo.png" style={{ height: 48, marginBottom: 16 }} />
                <div style={{ fontSize: 20, fontWeight: 700 }}>YMH Operasyon</div>
                <div style={{ color: '#71717A', fontSize: 13 }}>Devam etmek için saha seçin</div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {loading && <div style={{ textAlign: 'center', color: '#999' }}><Loader2 className="animate-spin" /> Yükleniyor...</div>}
                {!loading && projects.length === 0 && <div style={{ textAlign: 'center', color: '#A1A1AA', padding: 20 }}>Henüz kayıtlı saha yok.</div>}

                {projects.map(p => (
                    <div key={p.id} onClick={() => openDashboard(p)}
                        style={{
                            padding: 16, borderRadius: 16, border: '1px solid #E2E8F0',
                            display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                        }}>
                        <div style={{ width: 40, height: 40, background: '#F4F4F5', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={20} color="#52525B" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            <div style={{ fontSize: 12, color: '#A1A1AA' }}>{p.city}/{p.district}</div>
                        </div>
                        <ChevronRight size={16} color="#D4D4D8" style={{ marginLeft: 'auto' }} />
                    </div>
                ))}

                <div onClick={() => setView('new-site')}
                    style={{
                        padding: 16, borderRadius: 16, border: '2px dashed #E2E8F0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer',
                        marginTop: 12, color: '#71717A', fontWeight: 600
                    }}>
                    <Plus size={20} />
                    Yeni Saha Ekle
                </div>
            </div>

            {toast && (
                <div className="toast-box">
                    {toast.type === 'success' ? <CheckCircle size={20} color="#10B981" /> : <AlertTriangle size={20} color="#EF4444" />}
                    <div style={{ fontWeight: 600 }}>{toast.msg}</div>
                </div>
            )}
        </div>
    );

    // 1.5 YENI SAHA
    if (view === 'new-site') return (
        <div className="modal-overlay">
            <div className="modal-header">
                <div onClick={() => setView('auth')} style={{ padding: 4 }}><ArrowLeft size={24} /></div>
                <div className="modal-title">Yeni Saha</div>
            </div>
            <div className="form-scroll" style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
                <div className="form-section">
                    <div className="input-group">
                        <label className="input-label">SAHA ADI</label>
                        <input className="modern-input" placeholder="ÖRN: MERKEZ DEPO" autoFocus
                            value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)}
                        />
                    </div>
                    <div style={{ fontSize: 13, color: '#71717A', display: 'flex', gap: 8 }}>
                        <MapPin size={16} /> Konum otomatik eklenecektir.
                    </div>
                </div>
                <button className="btn-primary" onClick={createSite} disabled={loading}>
                    {loading ? 'Oluşturuluyor...' : 'Projeyi Başlat'}
                </button>
            </div>
            {toast && (
                <div className="toast-box">
                    <CheckCircle size={20} color="#10B981" />
                    <div style={{ fontWeight: 600 }}>{toast.msg}</div>
                </div>
            )}
        </div>
    );

    // 2. DASHBOARD
    if (view === 'dashboard') {
        const totalQty = transactions.reduce((acc, t) => acc + Number(t.quantity || 0), 0);

        return (
            <div id="root">
                {/* Header */}
                <div className="app-header">
                    <div className="brand">
                        <img src="/logo.png" />
                        <div className="brand-name">{activeProject?.name}</div>
                    </div>
                    <div onClick={() => { localStorage.removeItem('last_site_id'); setView('auth'); }}>
                        <div style={{ width: 36, height: 36, background: '#F4F4F5', borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <LogOut size={18} />
                        </div>
                    </div>
                </div>

                {/* Dashboard Content */}
                <div className="dashboard-grid">
                    {/* Stats */}
                    <div className="stats-container">
                        <div className="stat-card">
                            <div className="stat-label">Toplam Sefer</div>
                            <div className="stat-value">{transactions.length}</div>
                            <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 4 }}>Bugün: +{transactions.length}</div>
                        </div>
                        <div className="stat-card" style={{ background: '#18181B' }}>
                            <div className="stat-label" style={{ color: '#71717A' }}>Toplam Miktar</div>
                            <div className="stat-value" style={{ color: '#fff' }}>{totalQty}</div>
                            <div style={{ fontSize: 11, color: '#52525B', marginTop: 4 }}>Tonaj & Adet</div>
                        </div>
                    </div>

                    {/* Action Bar */}
                    <div style={{ display: 'flex', gap: 12, paddingBottom: 4, marginTop: 16 }}>
                        <div style={{ padding: '8px 16px', borderRadius: 20, background: '#18181B', color: '#fff', fontSize: 13, fontWeight: 600 }}>Tüm İşlemler</div>
                        <div style={{ padding: '8px 16px', borderRadius: 20, background: '#F4F4F5', color: '#71717A', fontSize: 13, fontWeight: 600 }}>Raporlar</div>
                    </div>

                    {/* List */}
                    <div className="activity-list" style={{ marginTop: 16 }}>
                        {transactions.map(t => (
                            <div key={t.id} className="activity-item">
                                <div className="activity-icon">
                                    {t.image_url ? <CheckCircle size={20} color="#10B981" /> : <Truck size={20} />}
                                </div>
                                <div className="activity-details">
                                    <div className="plate-no">{t.plate_no || 'Plaka Yok'}</div>
                                    <div className="material-name">{t.material} • {t.company || 'Firma Yok'}</div>
                                </div>
                                <div className="quantity-badge">
                                    {t.quantity} <span style={{ fontSize: 10 }}>{t.unit}</span>
                                </div>
                            </div>
                        ))}
                        {transactions.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#A1A1AA' }}>Bugün henüz işlem yok.</div>}
                    </div>
                </div>

                {/* FAB */}
                <div className="fab-btn" onClick={() => setView('form')}>
                    <Plus size={24} />
                </div>
            </div>
        );
    }

    // 3. FORM MODAL
    if (view === 'form') return (
        <div className="modal-overlay">
            <div className="modal-header">
                <div onClick={() => setView('dashboard')} style={{ padding: 4 }}><X size={24} /></div>
                <div className="modal-title">Yeni İrsaliye</div>
            </div>

            <div className="form-scroll">
                {/* Camera Widget */}
                <div className={`camera-widget ${wbForm.imgPreview ? 'active' : ''}`} onClick={wbForm.imgPreview ? undefined : takePhoto}>
                    {wbForm.imgPreview ? (
                        <>
                            <img src={wbForm.imgPreview} />
                            <div className="camera-overlay" onClick={() => setWbForm(prev => ({ ...prev, imgBlob: null, imgPreview: '' }))}>
                                <div style={{ background: '#fff', padding: '8px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>Fotoğrafı Sil</div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div style={{ width: 48, height: 48, borderRadius: 24, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                                <CameraIcon size={24} color="#64748B" />
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Fiş Fotoğrafı Çek</div>
                            <div style={{ fontSize: 12, color: '#94A3B8' }}>OCR ile otomatik okunur</div>
                        </>
                    )}
                </div>

                {/* Sections */}
                <div style={{ marginTop: 24 }}>
                    <div className="form-section">
                        <div className="form-section-title">Teslimat Bilgileri</div>
                        <div className="input-group">
                            <label className="input-label">ARAÇ PLAKASI</label>
                            <input className="modern-input" placeholder="35 ABC 123" value={wbForm.plate} onChange={e => setWbForm({ ...wbForm, plate: e.target.value.toUpperCase() })} />
                        </div>
                        <div className="form-row">
                            <div>
                                <label className="input-label">İRSALİYE NO</label>
                                <input className="modern-input" placeholder="123456" value={wbForm.invoice_no} onChange={e => setWbForm({ ...wbForm, invoice_no: e.target.value })} />
                            </div>
                            <div>
                                <label className="input-label">FİRMA</label>
                                <input className="modern-input" placeholder="Tedarikçi" value={wbForm.company} onChange={e => setWbForm({ ...wbForm, company: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="form-section-title">Malzeme & Miktar</div>
                        <div className="input-group">
                            <label className="input-label">MALZEME CİNSİ</label>
                            <select className="modern-input" value={wbForm.material} onChange={e => setWbForm({ ...wbForm, material: e.target.value })}>
                                {['HAFRİYAT', 'MİL KUM', 'BYPASS', 'BİMS(ADET)', 'BETON(M3)', 'FİLLER', 'PARKE(ADET/CİNS)', 'DİĞER'].map(m => (
                                    <option key={m} value={m}>{m}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-row">
                            <div>
                                <label className="input-label">MİKTAR</label>
                                <input type="number" className="modern-input" placeholder="0" value={wbForm.qty} onChange={e => setWbForm({ ...wbForm, qty: e.target.value })} />
                            </div>
                            <div>
                                <label className="input-label">BİRİM</label>
                                <select className="modern-input" value={wbForm.unit} onChange={e => setWbForm({ ...wbForm, unit: e.target.value })}>
                                    {['Sefer', 'Ton', 'm³', 'Adet', 'm²'].map(u => (
                                        <option key={u} value={u}>{u}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <button className="btn-primary" onClick={saveWaybill} disabled={loading}>
                    {loading ? 'Kaydediliyor...' : 'Kaydet ve Gönder'}
                </button>
                <div style={{ height: 40 }}></div>
            </div>

            {toast && (
                <div className="toast-box">
                    <CheckCircle size={20} color="#10B981" />
                    <div style={{ fontWeight: 600 }}>{toast.msg}</div>
                </div>
            )}
        </div>
    );
}
