import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ClipboardList, Target, Ruler, Activity, CalendarDays, Info, Save, Send, Eraser, FileText, X } from 'lucide-react';
import { calcularCumplimiento, determinarSemaforoDinamico, verificarCumplimientoDinamico } from '../utils/calculos';
import Swal from 'sweetalert2';
import { supabase } from '../lib/supabase';

// 🚀 Imports de nuestra nueva arquitectura limpia
import { useIndicadores } from '../hooks/useIndicadores';
import { registrosService } from '../services/registros.service';

const RegistroIndicadores: React.FC = () => {
    const { user } = useAuth();
    
    // Conectamos el Hook de Indicadores
    const { indicadores, loading: loadingInd, fetchIndicadores } = useIndicadores();
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estados del Formulario
    const [formData, setFormData] = useState({
        id: '', // ID del registro si estamos editando
        indicador_id: '',
        periodo: new Date().toISOString().slice(0, 10),
        resultado: '',
        analisis: '',
        plan: ''
    });

    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    // 1. Cargar los indicadores del Líder
    useEffect(() => {
        if (user?.proceso_id) {
            const isSGI = user.role === 'Sistema de Gestión Integral' || 
                         user.procesos?.nombre_proceso?.toLowerCase().includes('gestión integral') ||
                         user.procesos?.nombre_proceso?.toLowerCase().includes('gestion integral');
            fetchIndicadores(user.proceso_id, isSGI);
        }
    }, [user, fetchIndicadores]);

    // 2. Detectar modo edición desde URL
    useEffect(() => {
        const params = new URLSearchParams(window.location.hash.split('?')[1]);
        const editId = params.get('edit');
        if (editId) {
            const fetchExisting = async () => {
                const { data, error } = await supabase.from('registro_mensual_indicadores').select('*').eq('id', editId).maybeSingle();
                if (data && !error) {
                    if (data.estado_registro !== 'Borrador') {
                        Swal.fire({
                            title: 'Acción no permitida',
                            text: 'Este registro ya fue enviado y no puede editarse.',
                            icon: 'warning',
                            confirmButtonColor: '#b91c1c',
                            borderRadius: '1rem',
                        });
                        window.location.hash = '#/historico';
                        return;
                    }
                    setFormData({
                        id: data.id,
                        indicador_id: data.indicador_id,
                        periodo: data.periodo,
                        resultado: String(data.resultado_mensual),
                        analisis: data.observaciones || '',
                        plan: data.accion_mejora || ''
                    });
                }
            };
            fetchExisting();
        }
    }, []);

    // 3. Carga automática si ya existe un borrador al cambiar indicador/periodo
    useEffect(() => {
        if (!formData.indicador_id || !formData.periodo || formData.id) return;

        const checkExisting = async () => {
            // Usamos nuestro servicio limpio para buscar el borrador
            const borrador: any = await registrosService.getBorrador(formData.indicador_id, formData.periodo);
            
            if (borrador) {
                const result = await Swal.fire({
                    title: 'Borrador encontrado',
                    text: 'Se encontró un borrador guardado para este periodo. ¿Deseas cargarlo para continuar editando?',
                    icon: 'info',
                    showCancelButton: true,
                    confirmButtonColor: '#b91c1c',
                    cancelButtonColor: '#64748b',
                    confirmButtonText: 'Sí, cargar',
                    cancelButtonText: 'Ignorar',
                    borderRadius: '1rem',
                });

                if (result.isConfirmed) {
                    setFormData({
                        id: borrador.id,
                        indicador_id: borrador.indicador_id,
                        periodo: borrador.periodo,
                        resultado: String(borrador.resultado_mensual),
                        analisis: borrador.observaciones || '',
                        plan: borrador.accion_mejora || ''
                    });
                }
            }
        };
        checkExisting();
    }, [formData.indicador_id, formData.periodo]);

    const selectedInd = indicadores.find(i => i.id === formData.indicador_id);

    const handleSubmit = async (estado: 'Borrador' | 'Enviado') => {
        if (!formData.indicador_id || !formData.resultado || !formData.periodo) {
            Swal.fire({
                title: 'Campos incompletos',
                text: 'Por favor, complete los campos obligatorios.',
                icon: 'warning',
                confirmButtonColor: '#b91c1c',
                borderRadius: '1rem',
            });
            return;
        }
        if (!selectedInd) return;

        const pct = calcularCumplimiento(
            Number(formData.resultado),
            selectedInd.meta,
            selectedInd.umbral_verde,
            selectedInd.umbral_amarillo
        );

        const payload: any = {
            indicador_id: formData.indicador_id,
            proceso_id: selectedInd.proceso_id, // Usamos el ID del indicador para que quede en el subproceso correcto
            periodo: formData.periodo,
            resultado_mensual: Number(formData.resultado),
            meta: selectedInd.meta,
            unidad_medida: selectedInd.unidad_medida,
            cumple_meta: verificarCumplimientoDinamico(
                Number(formData.resultado), 
                selectedInd.meta, 
                selectedInd.umbral_verde, 
                selectedInd.umbral_amarillo
            ),
            porcentaje_cumplimiento: pct,
            semaforo: determinarSemaforoDinamico(Number(formData.resultado), selectedInd.umbral_verde, selectedInd.umbral_amarillo),
            observaciones: formData.analisis,
            accion_mejora: formData.plan,
            usuario_sistema: user?.id,
            nombre_responsable_registro: user?.full_name || user?.username,
            estado_registro: estado
        };

        setIsSubmitting(true);
        try {
            // Lógica de subida de archivo (Evidencia)
            if (file) {
                setIsUploading(true);
                const fileExt = file.name.split('.').pop();
                const fileName = `${formData.indicador_id}_${formData.periodo}_${Date.now()}.${fileExt}`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('evidencias')
                    .upload(filePath, file);

                if (uploadError) throw new Error('Error al subir la evidencia: ' + uploadError.message);

                const { data: { publicUrl } } = supabase.storage
                    .from('evidencias')
                    .getPublicUrl(filePath);

                payload.evidencia_url = publicUrl;
                setIsUploading(false);
            }
            if (formData.id) {
                // MODO ACTUALIZACIÓN
                await registrosService.actualizar(formData.id, payload);

                Swal.fire({
                    title: estado === 'Borrador' ? 'Borrador actualizado' : 'Registro enviado',
                    text: estado === 'Borrador' ? 'El borrador se actualizó correctamente.' : 'El registro fue enviado oficialmente.',
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                    borderRadius: '1rem',
                });
            } else {
                // MODO NUEVO: Validar duplicados finales directamente con la base de datos
                const { data: existente } = await supabase
                    .from('registro_mensual_indicadores')
                    .select('id, estado_registro')
                    .eq('indicador_id', formData.indicador_id)
                    .eq('periodo', formData.periodo)
                    .maybeSingle();

                if (existente) {
                    if (existente.estado_registro === 'Borrador') {
                        await registrosService.actualizar(existente.id, payload);
                    } else {
                        Swal.fire({
                            title: 'Registro duplicado',
                            text: 'Ya existe un registro ENVIADO para este periodo. No se puede duplicar.',
                            icon: 'error',
                            confirmButtonColor: '#b91c1c',
                            borderRadius: '1rem',
                        });
                        setIsSubmitting(false);
                        return;
                    }
                } else {
                    const nuevo = await registrosService.crear(payload);
                    if (estado === 'Borrador') {
                        setFormData(prev => ({ ...prev, id: nuevo.id }));
                    }
                }

                Swal.fire({
                    title: estado === 'Borrador' ? 'Borrador guardado' : 'Registro enviado',
                    text: estado === 'Borrador' ? 'El borrador se guardó exitosamente.' : 'El registro fue enviado correctamente.',
                    icon: 'success',
                    confirmButtonColor: '#10b981',
                    borderRadius: '1rem',
                });
            }

            // Limpiar y redirigir si se envió
            if (estado === 'Enviado') {
                setFormData({ id: '', indicador_id: '', periodo: new Date().toISOString().slice(0, 10), resultado: '', analisis: '', plan: '' });
                setFile(null);
                window.location.hash = '#/historico';
            }
        } catch (e: any) {
            Swal.fire({
                title: 'Error',
                text: 'Hubo un problema: ' + e.message,
                icon: 'error',
                confirmButtonColor: '#b91c1c',
                borderRadius: '1rem',
            });
        } finally {
            setIsSubmitting(false);
            setIsUploading(false);
        }
    };

    if (loadingInd) return <div className="p-10 text-center text-slate-400 font-bold uppercase text-xs tracking-widest">Cargando Formulario...</div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500 max-w-4xl mx-auto pb-10">
            {/* 1. HEADER ROJO */}
            <div className="bg-gradient-to-r from-[#b91c1c] to-[#0f172a] rounded-2xl p-8 text-white shadow-lg flex items-center gap-6">
                <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm"><ClipboardList size={32} /></div>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight mb-1">Registrar Indicador</h2>
                    <p className="text-red-100 text-sm font-medium opacity-90">Proceso: {user?.procesos?.codigo_proceso} - {user?.procesos?.nombre_proceso}</p>
                </div>
            </div>

            {/* 2. FORMULARIO */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest mb-6 border-b border-slate-50 pb-2">Datos del Reporte</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Seleccionar Indicador *</label>
                        <div className="relative">
                            <select
                                value={formData.indicador_id}
                                onChange={e => setFormData({ ...formData, indicador_id: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20 appearance-none"
                            >
                                <option value="">-- Seleccione --</option>
                                {indicadores.map(i => <option key={i.id} value={i.id}>{i.codigo_indicador} - {i.nombre_indicador}</option>)}
                            </select>
                            <Activity className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fecha de Reporte (Día/Mes/Año) *</label>
                        <div className="relative">
                            <input
                                type="date"
                                value={formData.periodo}
                                onChange={e => setFormData({ ...formData, periodo: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                            />
                            <CalendarDays className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                {/* === FICHA TÉCNICA (APARECE AL SELECCIONAR) === */}
                {selectedInd && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-8 animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold uppercase text-xs tracking-widest border-b border-slate-200 pb-2">
                            <Info size={14} /> Ficha Técnica del Indicador
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Meta</span>
                                <div className="flex items-center gap-2 text-lg font-black text-slate-900">
                                    <Target size={18} className="text-red-600" />
                                    {selectedInd.meta}{selectedInd.unidad_medida?.includes('%') ? '%' : ''}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Unidad</span>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Ruler size={16} className="text-slate-400" />
                                    {selectedInd.unidad_medida}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Frecuencia</span>
                                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                    <Activity size={16} className="text-slate-400" />
                                    {selectedInd.frecuencia}
                                </div>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Tipo</span>
                                <span className="bg-white border border-slate-200 px-2 py-1 rounded text-[10px] font-bold uppercase text-slate-500">{selectedInd.tipo_indicador}</span>
                            </div>
                        </div>

                        {selectedInd.descripcion && (
                            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 mb-6">
                                <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider block mb-1">📋 Descripción</span>
                                <p className="text-sm text-slate-700 font-medium leading-relaxed">{selectedInd.descripcion}</p>
                            </div>
                        )}

                        <div className="bg-white border-l-4 border-red-500 p-4 rounded-lg mb-6 shadow-sm">
                            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Fórmula de Cálculo</span>
                            <p className="text-sm font-bold text-slate-700 italic">
                                "{selectedInd.formula_calculo || 'No definida'}"
                            </p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                            <div className="bg-white border border-green-100 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-[10px] font-bold text-green-700 uppercase">Verde (Cumple)</span>
                                <span className="text-xs font-black text-green-700">≥ {selectedInd.umbral_verde}%</span>
                            </div>
                            <div className="bg-white border border-yellow-100 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-[10px] font-bold text-yellow-700 uppercase">Amarillo (Riesgo)</span>
                                <span className="text-xs font-black text-yellow-700">{selectedInd.umbral_amarillo}% - {selectedInd.umbral_verde - 1}%</span>
                            </div>
                            <div className="bg-white border border-red-100 p-3 rounded-lg flex justify-between items-center">
                                <span className="text-[10px] font-bold text-red-700 uppercase">Rojo (Crítico)</span>
                                <span className="text-xs font-black text-red-700">&lt; {selectedInd.umbral_rojo || selectedInd.umbral_amarillo}%</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* CAMPOS DE INGRESO */}
                <div className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Resultado Obtenido *</label>
                        <input
                            type="number"
                            placeholder="Ingrese el valor numérico..."
                            value={formData.resultado}
                            onChange={e => setFormData({ ...formData, resultado: e.target.value })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-2xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-red-500/20 placeholder:text-sm placeholder:font-normal"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Análisis de Causas *</label>
                        <textarea
                            rows={3}
                            placeholder="Explique las razones del resultado obtenido..."
                            value={formData.analisis}
                            onChange={e => setFormData({ ...formData, analisis: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Observación *</label>
                        <textarea
                            rows={3}
                            placeholder="Ingrese una observación sobre el resultado..."
                            value={formData.plan}
                            onChange={e => setFormData({ ...formData, plan: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-red-500/20"
                        />
                    </div>

                    {/* SECCIÓN DE EVIDENCIA (PDF) */}
                    <div className="space-y-3 pt-4 border-t border-slate-50">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <FileText size={14} className="text-red-600" />
                            Evidencia Documental (Opcional - Formato PDF máx. 15MB)
                        </label>
                        
                        <div className="flex items-center gap-4">
                            {!file ? (
                                <div className="relative flex-1">
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={(e) => {
                                            const selectedFile = e.target.files?.[0];
                                            if (selectedFile) {
                                                if (selectedFile.type !== 'application/pdf') {
                                                    Swal.fire('Formato no válido', 'Solo se permiten archivos PDF.', 'error');
                                                    return;
                                                }
                                                if (selectedFile.size > 15 * 1024 * 1024) {
                                                    Swal.fire('Archivo muy grande', 'El tamaño máximo es de 15MB.', 'error');
                                                    return;
                                                }
                                                setFile(selectedFile);
                                            }
                                        }}
                                        className="hidden"
                                        id="pdf-upload"
                                    />
                                    <label
                                        htmlFor="pdf-upload"
                                        className="flex items-center justify-center gap-3 w-full py-4 border-2 border-dashed border-slate-200 rounded-xl cursor-pointer hover:border-red-400 hover:bg-red-50/30 transition-all text-slate-400 font-bold text-xs uppercase"
                                    >
                                        <Save size={18} /> Seleccionar archivo PDF
                                    </label>
                                </div>
                            ) : (
                                <div className="flex-1 flex items-center justify-between bg-red-50 border border-red-100 p-4 rounded-xl">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-red-600 text-white p-2 rounded-lg">
                                            <FileText size={18} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-800 truncate max-w-[200px] md:max-w-md">{file.name}</p>
                                            <p className="text-[10px] text-red-600 font-bold uppercase">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setFile(null)}
                                        className="p-2 hover:bg-red-200 rounded-full text-red-600 transition-colors"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex gap-4 pt-8 border-t border-slate-50 mt-8">
                    <button disabled={isSubmitting} onClick={() => handleSubmit('Borrador')} className="flex items-center gap-2 px-6 py-3 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs uppercase hover:bg-slate-50 transition-all disabled:opacity-50">
                        <Save size={16} /> Borrador
                    </button>
                    <button disabled={isSubmitting || isUploading} onClick={() => handleSubmit('Enviado')} className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#b91c1c] hover:bg-[#991b1b] text-white font-bold text-xs uppercase shadow-lg shadow-red-900/20 transition-all flex-1 disabled:opacity-50">
                        {isSubmitting ? (isUploading ? 'Subiendo archivo...' : 'Procesando...') : <><Send size={16} /> Enviar Registro</>}
                    </button>
                    <button type="button" onClick={() => setFormData(prev => ({ ...prev, resultado: '', analisis: '', plan: '' }))} className="flex items-center gap-2 px-4 py-3 rounded-xl text-slate-400 hover:text-slate-600 transition-all">
                        <Eraser size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RegistroIndicadores;