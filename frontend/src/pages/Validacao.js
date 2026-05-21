import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { useValidation } from '../hooks/useValidation';
export const Validacao = () => {
    const { validar, isLoading, error } = useValidation();
    const [xmlContent, setXmlContent] = useState('');
    const [empresaId] = useState('12345678-1234-1234-1234-123456789012'); // Demo
    const [result, setResult] = useState(null);
    const [localError, setLocalError] = useState(null);
    const handleFileUpload = (e) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const content = event.target?.result;
                setXmlContent(content);
                setLocalError(null);
            };
            reader.onerror = () => {
                setLocalError('Erro ao ler arquivo');
            };
            reader.readAsText(file);
        }
    };
    const handleDragDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type === 'application/xml' || file.name.endsWith('.xml')) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setXmlContent(event.target?.result);
                setLocalError(null);
            };
            reader.readAsText(file);
        }
        else {
            setLocalError('Por favor, selecione um arquivo XML');
        }
    };
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLocalError(null);
        if (!xmlContent) {
            setLocalError('Por favor, selecione um arquivo XML');
            return;
        }
        const validationResult = await validar(xmlContent, empresaId);
        if (validationResult) {
            setResult(validationResult);
        }
    };
    const renderErrorList = (errors) => {
        const criticos = errors.filter((e) => e.severidade === 'critico');
        const avisos = errors.filter((e) => e.severidade === 'aviso');
        return (_jsxs("div", { className: "space-y-4", children: [criticos.length > 0 && (_jsxs("div", { children: [_jsxs("h4", { className: "text-lg font-semibold text-danger-600 mb-2", children: ["\u274C Erros Cr\u00EDticos (", criticos.length, ")"] }), _jsx("div", { className: "space-y-2", children: criticos.map((error) => (_jsxs("div", { className: "p-3 bg-danger-50 border border-danger-200 rounded-lg", children: [_jsx("p", { className: "font-medium text-danger-700", children: error.descricao }), _jsxs("p", { className: "text-sm text-danger-600 mt-1", children: ["\uD83D\uDCA1 ", error.sugestao] }), _jsxs("p", { className: "text-xs text-danger-500 mt-1", children: ["Campo: ", error.campo] })] }, error.id))) })] })), avisos.length > 0 && (_jsxs("div", { children: [_jsxs("h4", { className: "text-lg font-semibold text-yellow-600 mb-2", children: ["\u26A0\uFE0F Avisos (", avisos.length, ")"] }), _jsx("div", { className: "space-y-2", children: avisos.map((error) => (_jsxs("div", { className: "p-3 bg-yellow-50 border border-yellow-200 rounded-lg", children: [_jsx("p", { className: "font-medium text-yellow-700", children: error.descricao }), _jsxs("p", { className: "text-sm text-yellow-600 mt-1", children: ["\uD83D\uDCA1 ", error.sugestao] })] }, error.id))) })] }))] }));
    };
    return (_jsx("div", { className: "min-h-screen bg-gray-50", children: _jsxs("div", { className: "max-w-4xl mx-auto px-4 py-8", children: [_jsxs("div", { className: "mb-8", children: [_jsx("h1", { className: "text-3xl font-bold text-gray-900 mb-2", children: "Validar Nota Fiscal" }), _jsx("p", { className: "text-gray-600", children: "Fa\u00E7a upload de um arquivo XML de NF-e para valida\u00E7\u00E3o" })] }), _jsxs("div", { className: "grid grid-cols-1 lg:grid-cols-3 gap-6", children: [_jsx("div", { className: "lg:col-span-2", children: _jsxs("form", { onSubmit: handleSubmit, className: "space-y-4", children: [(localError || error) && (_jsx("div", { className: "p-4 bg-danger-50 border border-danger-200 rounded-lg", children: _jsx("p", { className: "text-danger-600 text-sm font-medium", children: localError || error }) })), _jsxs("div", { onDragOver: (e) => e.preventDefault(), onDrop: handleDragDrop, className: "border-2 border-dashed border-primary-300 rounded-lg p-8 text-center cursor-pointer hover:bg-primary-50 transition", children: [_jsx("div", { className: "text-4xl mb-2", children: "\uD83D\uDCC4" }), _jsx("p", { className: "text-gray-700 font-medium mb-2", children: "Arraste um arquivo XML aqui" }), _jsx("p", { className: "text-gray-500 text-sm mb-4", children: "ou clique para selecionar" }), _jsx("input", { type: "file", accept: ".xml", onChange: handleFileUpload, className: "hidden", id: "xml-upload", disabled: isLoading }), _jsx("label", { htmlFor: "xml-upload", className: "btn-primary cursor-pointer", children: "Selecionar Arquivo" })] }), xmlContent && (_jsxs("div", { className: "bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto", children: [_jsx("p", { className: "text-xs text-gray-400 mb-2", children: "XML Preview:" }), _jsxs("pre", { className: "text-sm max-h-48 overflow-auto", children: [xmlContent.substring(0, 500), "..."] })] })), _jsx("button", { type: "submit", disabled: isLoading || !xmlContent, className: "w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed", children: isLoading ? '⏳ Validando...' : '✓ Validar XML' })] }) }), _jsxs("div", { className: "card", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Informa\u00E7\u00F5es" }), _jsxs("div", { className: "space-y-4 text-sm", children: [_jsxs("div", { children: [_jsx("p", { className: "text-gray-500", children: "Arquivo" }), _jsx("p", { className: "text-gray-900 font-medium", children: xmlContent ? '✓ Selecionado' : '✗ Nenhum' })] }), _jsxs("div", { children: [_jsx("p", { className: "text-gray-500", children: "Tamanho" }), _jsx("p", { className: "text-gray-900 font-medium", children: xmlContent ? `${(xmlContent.length / 1024).toFixed(2)} KB` : '-' })] })] })] })] }), result && (_jsxs("div", { className: "mt-8", children: [_jsxs("div", { className: `p-6 rounded-lg mb-6 ${result.status === 'aprovado'
                                ? 'bg-success-50 border border-success-200'
                                : 'bg-danger-50 border border-danger-200'}`, children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsxs("div", { children: [_jsx("h3", { className: `text-xl font-bold ${result.status === 'aprovado'
                                                        ? 'text-success-600'
                                                        : 'text-danger-600'}`, children: result.status === 'aprovado' ? '✅ Validação Aprovada' : '❌ Validação Rejeitada' }), _jsx("p", { className: `text-sm ${result.status === 'aprovado'
                                                        ? 'text-success-600'
                                                        : 'text-danger-600'}`, children: result.message })] }), _jsxs("div", { className: "text-right", children: [_jsxs("p", { className: "text-2xl font-bold text-gray-900", children: [result.tempoProcessamento, "ms"] }), _jsx("p", { className: "text-xs text-gray-500", children: "Tempo de processamento" })] })] }), result.nf && (_jsxs("div", { className: "grid grid-cols-2 gap-4 pt-4 border-t border-current border-opacity-20", children: [_jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "NF-e" }), _jsx("p", { className: "text-sm font-medium text-gray-900", children: result.nf.numero })] }), _jsxs("div", { children: [_jsx("p", { className: "text-xs text-gray-500", children: "Valor" }), _jsxs("p", { className: "text-sm font-medium text-gray-900", children: ["R$ ", result.nf.valor.toFixed(2)] })] })] }))] }), result.erros && result.erros.length > 0 && (_jsxs("div", { className: "card", children: [_jsx("h3", { className: "text-lg font-semibold text-gray-900 mb-4", children: "Detalhes dos Erros" }), renderErrorList(result.erros)] }))] }))] }) }));
};
export default Validacao;
