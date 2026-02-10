
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
    Loader2,
    ScanLine,
    PenTool
} from 'lucide-react';

// DİKKAT: Mobil uygulamada (IPA/APK) buraya TAM IP ADRESİ yazılmalıdır.
// Bilgisayarınızın IP adresi: 172.20.10.3 (Loglardan alındı)
const API_URL = 'http://172.20.10.3:3000/api/v1';

export default function App() {
    /* --- STATE --- */
    const [view, setView] = useState<'auth' | 'dashboard' | 'form' | 'new-site'>('auth');
    const [loading, setLoading] = useState(false);
    const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
    const [showActionSheet, setShowActionSheet] = useState(false); // Yeni Menü State

    // Data
    const [projects, setProjects] = useState<any[]>([]);
    const [activeProject, setActiveProject] = useState<any>(null);
    const [transactions, setTransactions] = useState<any[]>([]);

    // New Site Form
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteLocation, setNewSiteLocation] = useState('');
    const [newSiteCoords, setNewSiteCoords] = useState<{ lat: number, lng: number } | null>(null);
    const [fetchedAddress, setFetchedAddress] = useState<{ city: string, district: string }>({ city: 'İzmir', district: 'Merkez' });

    // Transaction Form
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

    // Fonksiyon: Konumu Manuel veya Otomatik Çek
    const fetchLocation = async () => {
        setNewSiteLocation('Konum Alınıyor...');
        setNewSiteCoords(null);
        console.log('📍 Konum isteği gönderiliyor...');

        try {
            // Önce İzin İste (Kullanıcı Tıklamasıyla Tetiklenmeli)
            // iOS HTTP'de bazen bunu da engeller ama deniyoruz.
            try { await Geolocation.requestPermissions(); } catch (e) { console.log('İzin istendi:', e); }

            const pos = await Geolocation.getCurrentPosition({ timeout: 15000, enableHighAccuracy: true });
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            setNewSiteCoords({ lat, lng });

            // Adres Çözümleme
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                if (res.ok) {
                    const data = await res.json();
                    const addr = data.address;
                    const district = addr.suburb || addr.city_district || addr.town || 'Merkez';
                    const city = addr.province || addr.city || 'İzmir';
                    setFetchedAddress({ city, district });
                    setNewSiteLocation(data.display_name || `${lat}, ${lng}`);
                } else {
                    setNewSiteLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
                }
            } catch {
                setNewSiteLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
            }
        } catch (err: any) {
            console.error('Konum Hatası:', err);
            setNewSiteLocation(`HATA: Konum alınamadı. Lütfen elle girin.`);
        }
    };

    // Sayfa açılışında yine de şansımızı deneyelim
    useEffect(() => {
        if (view === 'new-site') {
            // Otomatik deneme (iOS engelleyebilir)
            fetchLocation();
        }
    }, [view]);

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
        if (!newSiteName) return showToast('Proje Adı Giriniz', 'error');
        setLoading(true);
        try {
            const payload = {
                name: newSiteName,
                code: `PROJE-${Date.now().toString().slice(-4)}`,
                city: fetchedAddress.city,
                district: fetchedAddress.district,
                status: 'ACTIVE',
                gps_lat: newSiteCoords?.lat || 0,
                gps_lng: newSiteCoords?.lng || 0
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
                showToast('Proje Oluşturuldu');
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

    // Form içinden veya Menüden çağrılabilir
    const takePhoto = async (openFormAfter = false) => {
        try {
            const image = await Camera.getPhoto({
                quality: 60, allowEditing: false, resultType: CameraResultType.Uri,
                saveToGallery: false
            });
            const response = await fetch(image.webPath!);
            const blob = await response.blob();

            // State güncelle
            setWbForm(prev => ({ ...prev, imgBlob: blob, imgPreview: image.webPath! }));

            // Eğer menüden çağrıldıysa formu aç
            if (openFormAfter) {
                setShowActionSheet(false);
                setView('form');
            }
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
                // Formu ve Resmi Temizle
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

    // 1. SAHA LISTESI (REDESIGNED FOR PREMIUM LOOK)
    if (view === 'auth') return (
        <div id="root" style={{ background: '#fff', padding: 32, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', marginBottom: 48, marginTop: 40 }}>
                {/* LOGO BOYUTU ARTTIRILDI */}
                <img src="/logo.png" style={{ height: 120, width: 'auto', marginBottom: 24, objectFit: 'contain' }} />

                <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>YMH Operasyon</div>
                <div style={{ color: '#71717A', fontSize: 15, lineHeight: 1.5 }}>
                    Devam etmek için bir proje seçin<br />veya yeni bir operasyon başlatın.
                </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {loading && <div style={{ textAlign: 'center', color: '#999', padding: 20 }}><Loader2 className="animate-spin" size={32} /></div>}

                {/* PROJE LISTESI */}
                {projects.map(p => (
                    <div key={p.id} onClick={() => openDashboard(p)}
                        style={{
                            padding: 20, borderRadius: 20, border: '1px solid #E2E8F0',
                            display: 'flex', alignItems: 'center', gap: 16, cursor: 'pointer',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.03)', background: '#fff'
                        }}>
                        <div style={{ width: 48, height: 48, background: '#F4F4F5', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Building2 size={24} color="#18181B" />
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: 16 }}>{p.name}</div>
                            <div style={{ fontSize: 13, color: '#A1A1AA' }}>{p.city}/{p.district}</div>
                        </div>
                        <ChevronRight size={20} color="#D4D4D8" style={{ marginLeft: 'auto' }} />
                    </div>
                ))}

                {/* YENI PROJE BUTONU (PREMIUM STYLE) - KESİK ÇİZGİ YERİNE DOLU BUTON */}
                <div onClick={() => setView('new-site')}
                    style={{
                        padding: 20, borderRadius: 20, background: '#18181B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, cursor: 'pointer',
                        marginTop: 16, color: '#fff', fontWeight: 700,
                        boxShadow: '0 8px 20px rgba(0,0,0,0.1)'
                    }}>
                    <Plus size={24} color="#FFD600" /> {/* Sarı ikon */}
                    <span style={{ fontSize: 16 }}>Yeni Proje Başlat</span>
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

    // 1.5 YENI PROJE
    if (view === 'new-site') return (
        <div className="modal-overlay">
            <div className="modal-header">
                <div onClick={() => setView('auth')} style={{ padding: 4 }}><ArrowLeft size={24} /></div>
                <div className="modal-title">Yeni Proje</div>
            </div>
            <div className="form-scroll" style={{ justifyContent: 'center', display: 'flex', flexDirection: 'column' }}>
                <div className="form-section">
                    <div className="input-group">
                        <label className="input-label">PROJE ADI</label>
                        <input className="modern-input" placeholder="ÖRN: MERKEZ DEPO" autoFocus
                            value={newSiteName} onChange={(e) => setNewSiteName(e.target.value)}
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">PROJE ADRESİ</label>
                        <div style={{ position: 'relative' }}>
                            <textarea className="modern-input"
                                value={newSiteLocation}
                                onChange={(e) => setNewSiteLocation(e.target.value)}
                                placeholder="Adres alınıyor..."
                                style={{ height: 80, resize: 'none', paddingTop: 12 }}
                            />
                            <div style={{ position: 'absolute', right: 12, top: 12, cursor: 'pointer' }} onClick={fetchLocation}>
                                {newSiteLocation === 'Konum Alınıyor...' || newSiteLocation === 'Adres getiriliyor...' ? (
                                    <Loader2 size={20} className="animate-spin" color="#A1A1AA" />
                                ) : (
                                    newSiteLocation.includes('HATA') || newSiteLocation.includes('Manuel') ?
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FEE2E2', padding: '4px 8px', borderRadius: 8 }}>
                                            <AlertTriangle size={16} color="#EF4444" />
                                            <span style={{ fontSize: 11, color: '#EF4444', fontWeight: 600 }}>Tekrar Dene</span>
                                        </div>
                                        : <MapPin size={20} color="#10B981" />
                                )}
                            </div>
                        </div>
                        <div style={{ fontSize: 11, color: '#A1A1AA', marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                            {/* Bilgi notu */}
                        </div>
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

                {/* FAB (Orta) */}
                <div className="fab-btn" onClick={() => setShowActionSheet(true)}>
                    <Plus size={24} />
                </div>

                {/* ACTION SHEET OVERLAY */}
                {showActionSheet && (
                    <div className="sheet-overlay" onClick={() => setShowActionSheet(false)}>
                        <div className="sheet-content" onClick={e => e.stopPropagation()}>
                            <div className="sheet-item" onClick={() => takePhoto(true)}>
                                <div className="sheet-icon-box" style={{ background: '#FEF3C7' }}>
                                    <ScanLine size={24} color="#D97706" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 16 }}>Fiş Tara / OCR</div>
                                    <div style={{ fontSize: 12, color: '#71717A' }}>Kamera ile otomatik okuma</div>
                                </div>
                                <ChevronRight size={20} color="#D4D4D8" style={{ marginLeft: 'auto' }} />
                            </div>

                            <div className="sheet-item" onClick={() => { setShowActionSheet(false); setView('form'); }}>
                                <div className="sheet-icon-box" style={{ background: '#F4F4F5' }}>
                                    <PenTool size={24} color="#52525B" />
                                </div>
                                <div>
                                    <div style={{ fontWeight: 600, fontSize: 16 }}>Manuel Giriş</div>
                                    <div style={{ fontSize: 12, color: '#71717A' }}>Elle veri doldurma formu</div>
                                </div>
                                <ChevronRight size={20} color="#D4D4D8" style={{ marginLeft: 'auto' }} />
                            </div>

                            <div style={{ textAlign: 'center', padding: 12, color: '#EF4444', fontWeight: 600, cursor: 'pointer' }} onClick={() => setShowActionSheet(false)}>
                                Vazgeç
                            </div>
                        </div>
                    </div>
                )}
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
                {/* Camera Widget (Preview) */}
                <div className={`camera-widget ${wbForm.imgPreview ? 'active' : ''}`} onClick={wbForm.imgPreview ? undefined : () => takePhoto(false)}>
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
                            <div style={{ fontWeight: 600, fontSize: 14 }}>Fiş Fotoğrafı Ekle</div>
                            <div style={{ fontSize: 12, color: '#94A3B8' }}>(Opsiyonel)</div>
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
