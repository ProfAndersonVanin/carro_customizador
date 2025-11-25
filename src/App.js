import React, { useState, useRef, useEffect } from 'react';
import './App.css';

const App = () => {
  // --- Estados ---
  const [imageSrc, setImageSrc] = useState(null);
  const [selectedColor, setSelectedColor] = useState('#ff0000');
  
  // Histórico para Undo
  const [history, setHistory] = useState([]); 

  // Estados da Seleção de Polígono
  const [isPolyMode, setIsPolyMode] = useState(false); // Ativa/Desativa modo seleção
  const [points, setPoints] = useState([]); // Pontos do polígono atual

  const canvasRef = useRef(null);

  // --- 1. Carregamento e Inicialização ---
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          setImageSrc(img);
          setHistory([]); 
          setPoints([]);
          setIsPolyMode(false);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (imageSrc && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      // Reseta o canvas
      const maxWidth = 1024;
      const scale = imageSrc.width > maxWidth ? maxWidth / imageSrc.width : 1;
      canvas.width = imageSrc.width * scale;
      canvas.height = imageSrc.height * scale;

      ctx.drawImage(imageSrc, 0, 0, canvas.width, canvas.height);
      
      // Salva o estado inicial como base do histórico (opcional, ou deixar vazio)
      // setHistory([ctx.getImageData(0, 0, canvas.width, canvas.height)]);
    }
  }, [imageSrc]);

  // --- 2. Redesenhar linhas enquanto o usuário seleciona ---
  // Sempre que 'points' muda, redesenhamos a imagem base + as linhas
  useEffect(() => {
    if (!canvasRef.current || !imageSrc) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Se temos histórico, a "imagem base" é o último estado. Se não, é a imagem original recarregada.
    // Para simplificar, vamos assumir que recuperamos o último estado válido:
    if (history.length > 0) {
        ctx.putImageData(history[history.length - 1], 0, 0);
    } else {
       // Se não tem histórico, desenha a imagem original (recuperando tamanho ajustado)
       // Nota: Em app real, ideal é ter um estado 'currentImageData' separado do history
       const maxWidth = 1024;
       const scale = imageSrc.width > maxWidth ? maxWidth / imageSrc.width : 1;
       ctx.drawImage(imageSrc, 0, 0, imageSrc.width * scale, imageSrc.height * scale);
    }

    // Desenha o Polígono por cima
    if (points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      
      // Fecha o loop visualmente para ajudar o usuário
      if (points.length > 2) {
          ctx.lineTo(points[0].x, points[0].y);
      }
      
      ctx.strokeStyle = '#00ff00'; // Linha verde neon
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Desenha bolinhas nos vértices
      ctx.fillStyle = 'yellow';
      points.forEach(p => {
          ctx.beginPath();
          ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
          ctx.fill();
      });
    }

  }, [points, history, imageSrc]);


  // --- 3. Manipulação de Cores (HSL Math) ---
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) } : null;
  };

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    if (max === min) h = s = 0; 
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
        default: break;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  const hslToRgb = (h, s, l) => {
    let r, g, b;
    if (s === 0) r = g = b = l; 
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1; if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  // --- 4. Interação com Canvas ---
  const handleCanvasClick = (e) => {
    if (!isPolyMode || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor(e.clientX - rect.left);
    const y = Math.floor(e.clientY - rect.top);

    // Adiciona ponto ao polígono
    setPoints([...points, { x, y }]);
  };

  const handleUndo = () => {
    // Remove o último estado do histórico
    setHistory(prev => prev.slice(0, -1));
    setPoints([]); // Limpa seleção atual ao desfazer
  };

  const clearSelection = () => {
      setPoints([]);
  };

  // --- 5. APLICAÇÃO DA COR (A Mágica) ---
  const applyColorToSelection = () => {
    if (points.length < 3 || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // 1. Salvar estado ATUAL no histórico antes de alterar (incluindo edições passadas)
    // Precisamos pegar a imagem "limpa" (sem as linhas verdes de seleção)
    // Como o useEffect desenha as linhas, precisamos redesenhar o histórico rapidinho
    // para pegar os dados limpos.
    if (history.length > 0) {
        ctx.putImageData(history[history.length - 1], 0, 0);
    } else {
        // Redesenha a imagem original se não houver histórico
        const maxWidth = 1024;
        const scale = imageSrc.width > maxWidth ? maxWidth / imageSrc.width : 1;
        ctx.drawImage(imageSrc, 0, 0, imageSrc.width * scale, imageSrc.height * scale);
    }
    
    // Captura os dados limpos para salvar no histórico e para editar
    const cleanImageData = ctx.getImageData(0, 0, width, height);
    
    // IMPORTANTE: Adiciona ao histórico AGORA
    setHistory(prev => [...prev, cleanImageData]);

    // Agora vamos editar 'cleanImageData'
    const data = cleanImageData.data;

    // 2. Criar uma "Máscara" Off-screen para saber quais pixels estão dentro do polígono
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = width;
    maskCanvas.height = height;
    const maskCtx = maskCanvas.getContext('2d');

    maskCtx.beginPath();
    maskCtx.moveTo(points[0].x, points[0].y);
    points.forEach(p => maskCtx.lineTo(p.x, p.y));
    maskCtx.closePath();
    maskCtx.fillStyle = '#FFFFFF'; // Branco = Área selecionada
    maskCtx.fill();

    const maskData = maskCtx.getImageData(0, 0, width, height).data;

    // 3. Preparar cores
    const targetRGB = hexToRgb(selectedColor);
    const targetHSL = rgbToHsl(targetRGB.r, targetRGB.g, targetRGB.b);

    // 4. Otimização: Bounding Box (Caixa delimitadora) para não varrer a imagem toda
    let minX = width, maxX = 0, minY = height, maxY = 0;
    points.forEach(p => {
        if (p.x < minX) minX = p.x;
        if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.y > maxY) maxY = p.y;
    });
    // Arredonda e garante limites
    minX = Math.max(0, Math.floor(minX));
    maxX = Math.min(width, Math.ceil(maxX));
    minY = Math.max(0, Math.floor(minY));
    maxY = Math.min(height, Math.ceil(maxY));

    // 5. Loop apenas na Bounding Box
    for (let y = minY; y < maxY; y++) {
        for (let x = minX; x < maxX; x++) {
            const index = (y * width + x) * 4;

            // Verifica se na máscara o pixel é branco (tem alpha ou cor)
            // O canal Alpha da máscara é maskData[index + 3]
            if (maskData[index + 3] > 0) {
                
                // Pega cor original
                const r = data[index];
                const g = data[index + 1];
                const b = data[index + 2];

                // HSL Blend
                const [, , l] = rgbToHsl(r, g, b);
                const newRGB = hslToRgb(targetHSL[0], targetHSL[1], l);

                data[index] = newRGB[0];
                data[index + 1] = newRGB[1];
                data[index + 2] = newRGB[2];
            }
        }
    }

    // 6. Aplica a imagem editada no canvas
    ctx.putImageData(cleanImageData, 0, 0);

    // 7. Limpa a seleção e sai do modo
    setPoints([]);
    setIsPolyMode(false);
  };

  return (
    <div className="app-container">
      <h1>Customizador de Veículos (Seleção Manual)</h1>
      
      <div className="controls">
        <div className="control-group">
          <label><strong>1. Carregar Foto</strong></label>
          <input type="file" accept="image/*" onChange={handleImageUpload} />
        </div>

        <div className="control-group">
          <label><strong>2. Escolher Cor</strong></label>
          <div style={{ display: 'flex', gap: '5px' }}>
             <input type="color" value={selectedColor} onChange={(e) => setSelectedColor(e.target.value)} />
             {['#FF0000', '#0000FF', '#00FF00', '#000000', '#FFFFFF'].map(c => (
                <div key={c} onClick={() => setSelectedColor(c)} style={{ width: '25px', height: '25px', backgroundColor: c, cursor: 'pointer', border: '1px solid #ccc' }} />
            ))}
          </div>
        </div>

        <div className="control-group">
            <label><strong>3. Ferramenta de Seleção</strong></label>
            {!isPolyMode ? (
                <button className="btn btn-primary" onClick={() => setIsPolyMode(true)}>
                    ✏️ Iniciar Seleção Manual
                </button>
            ) : (
                <div className="poly-controls">
                    <span style={{ fontSize: '0.9em', color: '#555' }}>
                        Clique na imagem para contornar a peça ({points.length} pts)
                    </span>
                    <button className="btn btn-success" onClick={applyColorToSelection}>
                        ✅ Pintar Área
                    </button>
                    <button className="btn btn-warning" onClick={clearSelection}>
                        ❌ Cancelar Pontos
                    </button>
                </div>
            )}
        </div>

        <div className="control-group" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-undo" onClick={handleUndo} disabled={history.length === 0}>
            ↩ Desfazer
          </button>
        </div>
      </div>

      <div className="canvas-container">
        {!imageSrc && <p style={{padding: '50px'}}>Carregue uma imagem...</p>}
        <canvas 
          ref={canvasRef} 
          onClick={handleCanvasClick}
          style={{ 
              cursor: isPolyMode ? 'crosshair' : 'default', 
              display: imageSrc ? 'block' : 'none', 
              maxWidth: '100%' 
          }}
        />
      </div>
    </div>
  );
};

export default App;