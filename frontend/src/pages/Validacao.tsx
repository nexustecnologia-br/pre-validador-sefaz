import { useState } from 'react';
import { useValidation, ValidationResult, ValidationError } from '../hooks/useValidation';

export const Validacao = () => {
  const { validar, isLoading, error } = useValidation();

  const [xmlContent, setXmlContent] = useState('');
  const [empresaId] = useState('12345678-1234-1234-1234-123456789012'); // Demo
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        setXmlContent(content);
        setLocalError(null);
      };
      reader.onerror = () => {
        setLocalError('Erro ao ler arquivo');
      };
      reader.readAsText(file);
    }
  };

  const handleDragDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === 'application/xml' || file.name.endsWith('.xml')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setXmlContent(event.target?.result as string);
        setLocalError(null);
      };
      reader.readAsText(file);
    } else {
      setLocalError('Por favor, selecione um arquivo XML');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
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

  const renderErrorList = (errors: ValidationError[]) => {
    const criticos = errors.filter((e) => e.severidade === 'critico');
    const avisos = errors.filter((e) => e.severidade === 'aviso');

    return (
      <div className="space-y-4">
        {criticos.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-danger-600 mb-2">
              ❌ Erros Críticos ({criticos.length})
            </h4>
            <div className="space-y-2">
              {criticos.map((error) => (
                <div
                  key={error.id}
                  className="p-3 bg-danger-50 border border-danger-200 rounded-lg"
                >
                  <p className="font-medium text-danger-700">{error.descricao}</p>
                  <p className="text-sm text-danger-600 mt-1">
                    💡 {error.sugestao}
                  </p>
                  <p className="text-xs text-danger-500 mt-1">
                    Campo: {error.campo}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {avisos.length > 0 && (
          <div>
            <h4 className="text-lg font-semibold text-yellow-600 mb-2">
              ⚠️ Avisos ({avisos.length})
            </h4>
            <div className="space-y-2">
              {avisos.map((error) => (
                <div
                  key={error.id}
                  className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg"
                >
                  <p className="font-medium text-yellow-700">{error.descricao}</p>
                  <p className="text-sm text-yellow-600 mt-1">
                    💡 {error.sugestao}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Validar Nota Fiscal
          </h1>
          <p className="text-gray-600">
            Faça upload de um arquivo XML de NF-e para validação
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Area */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Error Display */}
              {(localError || error) && (
                <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
                  <p className="text-danger-600 text-sm font-medium">
                    {localError || error}
                  </p>
                </div>
              )}

              {/* Drag & Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDragDrop}
                className="border-2 border-dashed border-primary-300 rounded-lg p-8 text-center cursor-pointer hover:bg-primary-50 transition"
              >
                <div className="text-4xl mb-2">📄</div>
                <p className="text-gray-700 font-medium mb-2">
                  Arraste um arquivo XML aqui
                </p>
                <p className="text-gray-500 text-sm mb-4">
                  ou clique para selecionar
                </p>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="xml-upload"
                  disabled={isLoading}
                />
                <label htmlFor="xml-upload" className="btn-primary cursor-pointer">
                  Selecionar Arquivo
                </label>
              </div>

              {/* XML Preview */}
              {xmlContent && (
                <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
                  <p className="text-xs text-gray-400 mb-2">XML Preview:</p>
                  <pre className="text-sm max-h-48 overflow-auto">
                    {xmlContent.substring(0, 500)}...
                  </pre>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || !xmlContent}
                className="w-full btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? '⏳ Validando...' : '✓ Validar XML'}
              </button>
            </form>
          </div>

          {/* Stats Panel */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Informações
            </h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-500">Arquivo</p>
                <p className="text-gray-900 font-medium">
                  {xmlContent ? '✓ Selecionado' : '✗ Nenhum'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Tamanho</p>
                <p className="text-gray-900 font-medium">
                  {xmlContent ? `${(xmlContent.length / 1024).toFixed(2)} KB` : '-'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="mt-8">
            <div
              className={`p-6 rounded-lg mb-6 ${
                result.status === 'aprovado'
                  ? 'bg-success-50 border border-success-200'
                  : 'bg-danger-50 border border-danger-200'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3
                    className={`text-xl font-bold ${
                      result.status === 'aprovado'
                        ? 'text-success-600'
                        : 'text-danger-600'
                    }`}
                  >
                    {result.status === 'aprovado' ? '✅ Validação Aprovada' : '❌ Validação Rejeitada'}
                  </h3>
                  <p
                    className={`text-sm ${
                      result.status === 'aprovado'
                        ? 'text-success-600'
                        : 'text-danger-600'
                    }`}
                  >
                    {result.message}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">
                    {result.tempoProcessamento}ms
                  </p>
                  <p className="text-xs text-gray-500">Tempo de processamento</p>
                </div>
              </div>

              {result.nf && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-current border-opacity-20">
                  <div>
                    <p className="text-xs text-gray-500">NF-e</p>
                    <p className="text-sm font-medium text-gray-900">
                      {result.nf.numero}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Valor</p>
                    <p className="text-sm font-medium text-gray-900">
                      R$ {result.nf.valor.toFixed(2)}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Error List */}
            {result.erros && result.erros.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Detalhes dos Erros
                </h3>
                {renderErrorList(result.erros)}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Validacao;
