import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'

const files = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/style.css': ['style.css', 'text/css; charset=utf-8'],
  '/app.js': ['app.js', 'text/javascript; charset=utf-8'],
  '/catalog.js': ['catalog.js', 'text/javascript; charset=utf-8'],
  '/workbook.js': ['workbook.js', 'text/javascript; charset=utf-8'],
  '/photos.js': ['photos.js', 'text/javascript; charset=utf-8'],
  '/growth.js': ['growth.js', 'text/javascript; charset=utf-8'],
  '/care.js': ['care.js', 'text/javascript; charset=utf-8'],
  '/jszip.min.js': ['jszip.min.js', 'text/javascript; charset=utf-8'],
  '/JSZip-LICENSE.markdown': ['JSZip-LICENSE.markdown', 'text/plain; charset=utf-8'],
  '/original-data.js': ['original-data.js', 'text/javascript; charset=utf-8'],
  '/plant-fit-template.xlsx': ['plant-fit-template.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
}

const port = Number(process.env.PLANT_FIT_PORT ?? 4187)
createServer(async (request, response) => {
  const pathname = request.url.split('?')[0]
  const file = Object.hasOwn(files, pathname) ? files[pathname] : null
  if (!file || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(file ? 405 : 404).end()
    return
  }
  try {
    const [name, type] = file
    const contents = await readFile(new URL(name, import.meta.url))
    response.writeHead(200, {
      'Content-Type': type,
      'Content-Length': contents.length,
      'Cache-Control': 'no-store',
      'X-Plant-Fit': 'local',
      'X-Content-Type-Options': 'nosniff'
    })
    response.end(request.method === 'HEAD' ? undefined : contents)
  } catch {
    response.writeHead(500).end()
  }
}).listen(port, '127.0.0.1', () => console.log(`http://127.0.0.1:${port}/`))
