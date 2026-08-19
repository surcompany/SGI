import React, { useEffect, useState, useMemo, useTransition } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { History, Activity, TrendingUp, TrendingDown, LayoutDashboard, List as ListIcon, Calendar, Edit2, Trash2, ChevronLeft, ChevronRight, X, FileText } from 'lucide-react';
import Swal from 'sweetalert2';

// 🚀 Imports de nuestra nueva arquitectura limpia
import { useRegistros } from '../hooks/useRegistros';
import { useIndicadores } from '../hooks/useIndicadores';
import { useProcesos } from '../hooks/useProcesos';
import { registrosService } from '../services/registros.service';

const Historico: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Conectamos los Hooks
  const { registros, loading: loadingReg, fetchRegistrosFiltrados } = useRegistros();
  const { indicadores, loading: loadingInd, fetchIndicadores } = useIndicadores();
  const { procesos, loading: loadingProc, fetchProcesos } = useProcesos();

  // Estados de Filtros
  const [filterProceso, setFilterProceso] = useState('Todos los procesos');
  const [filterIndicador, setFilterIndicador] = useState('Todos los indicadores');
  const [filterFrecuencia, setFilterFrecuencia] = useState('Todas');
  const [filterDesde, setFilterDesde] = useState('2025-01');
  const [filterHasta, setFilterHasta] = useState('2026-12');

  const [showDashboard, setShowDashboard] = useState(user?.role === 'Administrador');
  const [isPending, startTransition] = useTransition();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // EFECTO 1: Cargar datos iniciales usando los servicios limpios
  useEffect(() => {
    fetchProcesos();
    fetchIndicadores();
    
    const isSGI = user?.proceso_id === 'd1aa17de-5003-4f65-a010-e3e81e3ec906' || 
                 user?.procesos?.nombre_proceso?.includes('Integral');

    fetchRegistrosFiltrados({
      esAdmin: user?.role === 'Administrador',
      userProcesoId: user?.proceso_id || undefined,
      isHierarchical: isSGI
    });
  }, [user, fetchProcesos, fetchIndicadores, fetchRegistrosFiltrados]);

  // EFECTO 2: Aplicar filtros si vienen de otra página (Navegación cruzada)
  useEffect(() => {
    if (location.state) {
      if (location.state.filterProceso) setFilterProceso(location.state.filterProceso);
      if (location.state.filterIndicador) setFilterIndicador(location.state.filterIndicador);
    }
  }, [location.state]);

  const handleDelete = async (id: string) => {
    const result = await Swal.fire({
      title: '¿Estás seguro?',
      text: "Esta acción no se puede deshacer y el registro se eliminará permanentemente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#b91c1c',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      borderRadius: '1rem',
    });

    if (!result.isConfirmed) return;

    try {
      await registrosService.eliminar(id);
      
      // Refrescamos los datos desde la BD para mantener la sincronización perfecta
      fetchRegistrosFiltrados({
        esAdmin: user?.role === 'Administrador',
        userProcesoId: user?.proceso_id || undefined
      });

      Swal.fire({
        title: '¡Eliminado!',
        text: 'El registro ha sido eliminado correctamente.',
        icon: 'success',
        confirmButtonColor: '#10b981',
        borderRadius: '1rem',
      });
    } catch (e: any) {
      Swal.fire({
        title: 'Error al eliminar',
        text: e.message,
        icon: 'error',
        confirmButtonColor: '#b91c1c',
        borderRadius: '1rem',
      });
    }
  };

  // Lógica de Filtrado Local (Se mantiene intacta para no romper tus gráficas)
  const getYearMonth = (fecha: string) => fecha?.substring(0, 7) ?? '';

  const filtered = registros.filter(r => {
    // Si ya están en el array 'registros' es porque el servidor nos dio permiso de verlos
    const matchProceso = filterProceso === 'Todos los procesos' || r.procesos?.nombre_proceso === filterProceso;
    const matchIndicador = filterIndicador === 'Todos los indicadores' || r.indicadores?.nombre_indicador === filterIndicador;
    const matchFrecuencia = filterFrecuencia === 'Todas' || r.indicadores?.frecuencia === filterFrecuencia;
    const matchFecha = getYearMonth(r.periodo) >= filterDesde && getYearMonth(r.periodo) <= filterHasta;

    return matchProceso && matchIndicador && matchFrecuencia && matchFecha;
  });

  const dashboardData = useMemo(() => {
    const porIndicador: Record<string, any> = {};
    const sorted = [...filtered].sort((a, b) => a.periodo.localeCompare(b.periodo));

    sorted.forEach(r => {
      const key = r.indicador_id;
      if (!porIndicador[key]) {
        porIndicador[key] = {
          nombre: r.indicadores?.nombre_indicador || 'N/A',
          codigo: r.indicadores?.codigo_indicador || 'N/A',
          datos: [],
          registrosTotales: 0,
          actual: 0,
          anterior: 0,
          variacion: null,
          semaforoActual: 'Verde'
        };
      }
      porIndicador[key].datos.push({
        periodo: r.periodo,
        val: Math.round(r.porcentaje_cumplimiento),
        semaforo: r.semaforo
      });
    });

    Object.keys(porIndicador).forEach(key => {
      const ind = porIndicador[key];
      const n = ind.datos.length;
      ind.registrosTotales = n;
      if (n > 0) {
        ind.actual = Math.round(ind.datos[n - 1].val);
        ind.semaforoActual = ind.datos[n - 1].semaforo;
        if (n > 1) {
          ind.anterior = Math.round(ind.datos[n - 2].val);
          if (ind.anterior !== 0) {
            ind.variacion = Math.round(((ind.actual - ind.anterior) / ind.anterior) * 100);
          }
        }
      }
    });

    return Object.values(porIndicador);
  }, [filtered]);

  const lineChartData = useMemo(() => {
    const periodos = Array.from(new Set(filtered.map(r => r.periodo))).sort();
    return periodos.map(p => {
      const entry: any = { name: p };
      dashboardData.forEach(ind => {
        const d = ind.datos.find((x: any) => x.periodo === p);
        if (d) entry[ind.codigo] = d.val;
      });
      return entry;
    });
  }, [dashboardData, filtered]);

  const COLORS = ['#b91c1c', '#10b981', '#f59e0b', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#475569'];

  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(filtered.length / itemsPerPage);

  const procesosDisponibles = useMemo(() => {
    if (user?.role === 'Administrador') return procesos;
    
    // Si soy SGI, puedo ver todos los procesos que aparezcan en mis registros (que ya son jerárquicos)
    const idsEnRegistros = Array.from(new Set(registros.map(r => r.proceso_id)));
    return procesos.filter(p => p.id === user?.proceso_id || idsEnRegistros.includes(p.id));
  }, [procesos, user, registros]);

  const indicadoresDisponibles = useMemo(() => {
    const idsDisponibles = procesosDisponibles.map(p => p.id);
    const indicadoresPermitidos = indicadores.filter(i => idsDisponibles.includes(i.proceso_id));

    if (filterProceso === 'Todos los procesos') return indicadoresPermitidos;
    const procSeleccionado = procesosDisponibles.find(p => p.nombre_proceso === filterProceso);
    return indicadoresPermitidos.filter(i => i.proceso_id === procSeleccionado?.id);
  }, [indicadores, filterProceso, procesosDisponibles]);

  const isLoading = loadingReg || loadingInd || loadingProc;

  if (isLoading) return <div className="p-10 text-center text-slate-400 text-xs font-bold uppercase tracking-widest">Cargando Histórico...</div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      <div className="bg-gradient-to-r from-[#b91c1c] to-[#0f172a] rounded-2xl p-8 text-white shadow-lg flex items-center gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-3xl font-bold tracking-tight mb-1">Histórico</h2>
          <p className="text-red-100 text-sm font-medium opacity-90">Consulta histórica de tendencias y registros</p>
        </div>
        <History size={48} className="absolute right-10 top-1/2 -translate-y-1/2 text-white/10" />
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proceso</label>
          <select value={filterProceso} onChange={e => {
            const val = e.target.value;
            startTransition(() => {
              setFilterProceso(val);
              setFilterIndicador('Todos los indicadores');
              setCurrentPage(1);
            });
          }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-50" disabled={isPending}>
            <option value="Todos los procesos">
              {user?.role === 'Administrador' ? 'Todos los procesos' : 'Todos mis procesos'}
            </option>
            {procesosDisponibles.map(p => <option key={p.id}>{p.nombre_proceso}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Indicador</label>
          <select value={filterIndicador} onChange={e => {
            const val = e.target.value;
            startTransition(() => {
              setFilterIndicador(val);
              setCurrentPage(1);
            });
          }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-50" disabled={isPending}>
            <option>Todos los indicadores</option>
            {indicadoresDisponibles.map(i => <option key={i.id}>{i.nombre_indicador}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Frecuencia</label>
          <select value={filterFrecuencia} onChange={e => {
            const val = e.target.value;
            startTransition(() => {
              setFilterFrecuencia(val);
              setCurrentPage(1);
            });
          }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-50" disabled={isPending}>
            <option value="Todas">Todas</option>
            <option value="Mensual">Mensuales</option>
            <option value="Trimestral">Trimestrales</option>
            <option value="Anual">Anuales</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Desde</label>
          <input type="month" value={filterDesde} onChange={e => { 
            const val = e.target.value;
            startTransition(() => {
              setFilterDesde(val); 
              setCurrentPage(1); 
            });
          }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-50" disabled={isPending} />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hasta</label>
          <input type="month" value={filterHasta} onChange={e => { 
            const val = e.target.value;
            startTransition(() => {
              setFilterHasta(val); 
              setCurrentPage(1); 
            });
          }} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold text-slate-700 outline-none disabled:opacity-50" disabled={isPending} />
        </div>
      </div>

      <div className="flex justify-between items-center px-2">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          Mostrando {filtered.length} registros
        </p>
        {user?.role === 'Administrador' && (
          <div className="bg-slate-100 rounded-lg p-1 flex gap-1 border border-slate-200 shadow-inner">
            <button
              onClick={() => setShowDashboard(true)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${showDashboard ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <LayoutDashboard size={14} /> Dashboard
            </button>
            <button
              onClick={() => setShowDashboard(false)}
              className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${!showDashboard ? 'bg-white text-red-700 shadow-sm' : 'text-slate-500 hover:bg-slate-200'}`}
            >
              <ListIcon size={14} /> Lista
            </button>
          </div>
        )}
      </div>

      {showDashboard && user?.role === 'Administrador' ? (
        <div className="space-y-8 animate-in fade-in zoom-in-95 duration-500">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3 mb-8 border-b border-slate-50 pb-4">
              <TrendingUp size={20} className="text-red-600" />
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-widest">Tendencia de Cumplimiento (%)</h3>
            </div>
            <div className="h-[500px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineChartData} margin={{ top: 20, right: 30, left: 10, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <ReferenceLine y={100} stroke="#fbbf24" strokeDasharray="5 5" strokeWidth={1.5} label={{ position: 'right', value: 'Meta', fill: '#b45309', fontSize: 10, fontWeight: 'bold' }} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 'bold' }} domain={[0, 'auto']} tickFormatter={(value) => `${value}%`} />
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', padding: '12px' }} labelStyle={{ fontWeight: '800', color: '#0f172a', marginBottom: '8px', fontSize: '13px' }} itemStyle={{ fontWeight: '600', fontSize: '12px', padding: '2px 0' }} formatter={(value: any) => [`${value}%`, 'Cumplimiento']} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontWeight: 'bold', color: '#475569' }} />
                  {dashboardData.map((ind, index) => (
                    <Line key={ind.codigo} type="monotone" dataKey={ind.codigo} name={`${ind.codigo} - ${ind.nombre}`} stroke={COLORS[index % COLORS.length]} strokeWidth={2.5} dot={{ r: 3.5, strokeWidth: 1.5, fill: '#fff' }} activeDot={{ r: 6, strokeWidth: 0 }} connectNulls={true} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {dashboardData.map((ind) => (
              <div key={ind.codigo} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-lg transition-all border-l-4" style={{ borderLeftColor: ind.semaforoActual === 'Verde' ? '#10b981' : ind.semaforoActual === 'Amarillo' ? '#f59e0b' : '#ef4444' }}>
                <div className="flex justify-between items-start mb-4">
                  <div className="bg-slate-50 p-2 rounded-lg text-slate-400 group-hover:text-red-600 transition-colors">
                    <Activity size={18} />
                  </div>
                  <div className={`flex items-center gap-1 text-[10px] font-black uppercase ${ind.variacion === null ? 'text-slate-400' : ind.variacion >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {ind.variacion !== null && (ind.variacion >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />)}
                    {ind.variacion === null ? 'Sin historial suficiente' : `${Math.abs(ind.variacion)}% vs anterior`}
                  </div>
                </div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 truncate" title={ind.codigo}>{ind.codigo}</h4>
                <p className="text-sm font-bold text-slate-800 line-clamp-1 mb-4" title={ind.nombre}>{ind.nombre}</p>
                <div className="flex items-end justify-between">
                  <div>
                    <span className="text-3xl font-black text-slate-900">{ind.actual}%</span>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Último periodo registrado</p>
                  </div>
                  <div className={`w-3 h-3 rounded-full shadow-sm animate-pulse ${ind.semaforoActual === 'Verde' ? 'bg-green-500' : ind.semaforoActual === 'Amarillo' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-top-4 duration-500">
          {paginated.length === 0 ? (
            <div className="p-10 bg-white rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-sm font-bold uppercase">No se encontraron registros con estos filtros en tu área.</div>
          ) : paginated.map(r => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-6 hover:shadow-md transition-all animate-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-start mb-4 border-b border-slate-50 pb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-red-700 font-bold text-sm">{r.indicadores?.codigo_indicador}</span>
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 uppercase">{r.procesos?.codigo_proceso}</span>
                    <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded border border-blue-100 uppercase flex items-center gap-1"><Calendar size={10} /> {r.periodo}</span>
                    <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${r.semaforo === 'Verde' ? 'bg-green-50 text-green-700' : r.semaforo === 'Amarillo' ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                      <div className={`w-2 h-2 rounded-full ${r.semaforo === 'Verde' ? 'bg-green-500' : r.semaforo === 'Amarillo' ? 'bg-yellow-500' : 'bg-red-500'}`}></div>
                      {r.semaforo === 'Verde' ? 'Cumple' : r.semaforo === 'Amarillo' ? 'En Seguimiento' : 'No Cumple'}
                    </div>
                  </div>
                  <h4 className="text-base font-bold text-slate-800">{r.indicadores?.nombre_indicador}</h4>
                  <p className="text-xs text-slate-400">{r.procesos?.nombre_proceso}</p>
                </div>
                <div className="text-right">
                  {(() => {
                    const unidad = r.unidad_medida?.trim() === '%' ? '%' : (r.unidad_medida ? ` ${r.unidad_medida}` : '');
                    return (
                      <>
                        <span className="block text-3xl font-black text-slate-900 leading-none">{Math.round(r.resultado_mensual || 0)}<span className="text-lg">{unidad}</span></span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Meta: {r.meta}{unidad}</span>
                        <p className={`text-[10px] font-bold uppercase mt-1 ${r.cumple_meta ? 'text-green-600' : 'text-red-600'}`}>{r.cumple_meta ? '✓ Cumple Meta' : '✕ No Cumple Meta'}</p>
                      </>
                    );
                  })()}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-slate-50/50 p-4 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><Activity size={10} /> Análisis del Resultado</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{r.observaciones || 'Sin análisis registrado.'}</p>
                </div>
                <div className="bg-slate-50/50 p-4 rounded-lg">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2 flex items-center gap-1"><TrendingUp size={10} /> Observación</p>
                  <p className="text-xs text-slate-700 leading-relaxed">{r.accion_mejora || 'Sin Observación registrada.'}</p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-50 flex justify-between items-center text-[10px] text-slate-400 font-medium">
                <div className="flex items-center gap-4">
                  <span>Registrado por: <span className="font-bold text-slate-600">{r.nombre_responsable_registro}</span></span>
                  {r.estado_registro === 'Borrador' && user?.role === 'Líder de Proceso' && (
                    <button
                      onClick={() => { window.location.hash = `#/registro?edit=${r.id}`; }}
                      className="flex items-center gap-1 bg-amber-50 text-amber-700 px-3 py-1 rounded-lg border border-amber-100 hover:bg-amber-100 transition-colors font-bold uppercase cursor-pointer"
                    >
                      <Edit2 size={10} /> Editar Borrador
                    </button>
                  )}
                  {user?.role === 'Administrador' && (
                    <button
                      onClick={() => handleDelete(r.id)}
                      className="flex items-center gap-1 bg-red-50 text-red-700 px-3 py-1 rounded-lg border border-red-100 hover:bg-red-100 transition-colors font-bold uppercase cursor-pointer"
                    >
                      <Trash2 size={10} /> Eliminar
                    </button>
                  )}
                  {r.evidencia_url && (
                    <a
                      href={r.evidencia_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 bg-blue-50 text-blue-700 px-3 py-1 rounded-lg border border-blue-100 hover:bg-blue-100 transition-colors font-bold uppercase cursor-pointer no-underline"
                    >
                      <FileText size={10} /> Ver Evidencia
                    </a>
                  )}
                </div>
                <span className={`px-3 py-1 rounded-full uppercase font-bold text-[10px] ${r.estado_registro === 'Finalizado' ? 'bg-slate-900 text-white' : 'bg-amber-100 text-amber-800'}`}>{r.estado_registro}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-center gap-4 mt-8 border-t border-slate-100 pt-8">
        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"><ChevronLeft size={16} /></button>
        <span className="text-xs font-bold text-slate-600 flex items-center bg-slate-50 px-4 rounded-lg border border-slate-200">Página {currentPage} de {totalPages}</span>
        <button disabled={currentPage === totalPages || totalPages === 0} onClick={() => setCurrentPage(p => p + 1)} className="p-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-all"><ChevronRight size={16} /></button>
      </div>
    </div>
  );
};

export default Historico;