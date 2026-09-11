const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DEST_FOLDER = process.env.DESTINATION_FOLDER || '/reportsGDP';

// Habilitar CORS
app.use(cors());
app.use(express.json());

// Configuração do Multer para salvar arquivos recebidos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    try {
      if (!fs.existsSync(DEST_FOLDER)) {
        fs.mkdirSync(DEST_FOLDER, { recursive: true });
      }
      cb(null, DEST_FOLDER);
    } catch (err) {
      cb(new Error(`Erro ao criar diretório de destino: ${err.message}`));
    }
  },
  filename: function (req, file, cb) {
    // Sobrescreve arquivos existentes com o mesmo nome
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage });

// 1. Endpoint dinâmico de upload para o n8n
app.post('/salvar-planilha', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado no campo "file".' });
    }

    const fullUrl = `${req.protocol}://${req.get('host')}/reportsGDP/${req.file.filename}`;

    console.log(`[${new Date().toISOString()}] Planilha salva: ${req.file.filename}`);

    return res.status(201).json({
      message: 'Arquivo salvo com sucesso!',
      filename: req.file.filename,
      url: fullUrl,
      size: req.file.size,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Erro ao salvar planilha:', error);
    return res.status(500).json({ error: `Erro interno: ${error.message}` });
  }
});

const { createProxyMiddleware } = require('http-proxy-middleware');

// 2. Proxy reverso unificado para o Streamlit (Portal de Engenharia)
const streamlitProxy = createProxyMiddleware({
  target: 'http://relatorio-fotografico:8501',
  changeOrigin: true,
  ws: true,
  pathRewrite: (path, req) => {
    if (path.startsWith('/relatorio-fotografico')) {
      return path.replace('/relatorio-fotografico', '/appsengenharia');
    }
    if (path.startsWith('/appsengenharia')) {
      return path;
    }
    return '/appsengenharia' + path;
  }
});

app.use('/appsengenharia', streamlitProxy);
app.use('/relatorio-fotografico', streamlitProxy);

// 3. Rota GET /reportsGDP - Gera lista/índice HTML dos relatórios salvos
app.get('/reportsGDP', (req, res) => {
  fs.readdir(DEST_FOLDER, { withFileTypes: true }, (err, files) => {
    if (err) {
      console.error('Erro ao ler pasta de relatórios:', err);
      return res.status(500).send('Erro interno ao ler pasta de relatórios.');
    }
    
    // Mapeia e formata os dados de cada arquivo
    const fileList = files
      .filter(f => f.isFile())
      .map(f => {
        const filePath = path.join(DEST_FOLDER, f.name);
        const stats = fs.statSync(filePath);
        return {
          name: f.name,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          mtime: stats.mtime.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
        };
      });

    let html = `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Índice de Relatórios - GDP</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          background-color: #1A2226;
          color: #B8C7CE;
          margin: 0;
          padding: 24px;
        }
        h1 {
          color: #FFFFFF;
          font-size: 24px;
          border-bottom: 2px solid #3C8DBC;
          padding-bottom: 12px;
          margin-bottom: 24px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background-color: #222D32;
          border-radius: 4px;
          overflow: hidden;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        th, td {
          padding: 12px 16px;
          text-align: left;
        }
        th {
          background-color: #3C8DBC;
          color: #FFFFFF;
          font-weight: 600;
          font-size: 14px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        tr:nth-child(even) {
          background-color: #2c383e;
        }
        tr:hover {
          background-color: #34434a;
        }
        a {
          color: #3C8DBC;
          text-decoration: none;
          font-weight: 500;
        }
        a:hover {
          text-decoration: underline;
          color: #4da3d4;
        }
        .empty {
          padding: 32px;
          text-align: center;
          font-style: italic;
          color: #7f8c8d;
        }
      </style>
    </head>
    <body>
      <h1>Índice de Relatórios - GDP</h1>
      <table>
        <thead>
          <tr>
            <th>Nome do Arquivo</th>
            <th>Tamanho</th>
            <th>Última Modificação</th>
          </tr>
        </thead>
        <tbody>
    `;

    if (fileList.length === 0) {
      html += `<tr><td colspan="3" class="empty">Nenhum relatório encontrado neste diretório.</td></tr>`;
    } else {
      fileList.forEach(file => {
        html += `
          <tr>
            <td><a href="/reportsGDP/${encodeURIComponent(file.name)}">${file.name}</a></td>
            <td>${file.size}</td>
            <td>${file.mtime}</td>
          </tr>
        `;
      });
    }

    html += `
        </tbody>
      </table>
    </body>
    </html>
    `;

    res.send(html);
  });
});

// 3. Servir arquivos individuais do diretório de relatórios na rota /reportsGDP/...
app.use('/reportsGDP', express.static(DEST_FOLDER));

// 4. Servir todos os widgets e arquivos estáticos na rota raiz /
app.use(express.static(__dirname));

// Tratamento de erro padrão
app.use((err, req, res, next) => {
  console.error('Erro no Servidor:', err.message);
  res.status(500).json({ error: err.message });
});

const server = app.listen(PORT, () => {
  console.log(`Servidor unificado rodando com sucesso na porta ${PORT}`);
  console.log(`Modo estático ativo para o diretório: ${__dirname}`);
  console.log(`Diretório de relatórios ativo em: ${DEST_FOLDER}`);
});

// Captura requisições de upgrade de WebSocket e repassa para o proxy do Streamlit
server.on('upgrade', (request, socket, head) => {
  if (request.url.startsWith('/relatorio-fotografico')) {
    request.url = request.url.replace('/relatorio-fotografico', '/appsengenharia');
  }
  if (request.url.startsWith('/appsengenharia') && typeof streamlitProxy.upgrade === 'function') {
    streamlitProxy.upgrade(request, socket, head);
  }
});
