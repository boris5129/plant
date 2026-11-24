function invalid(message = '지원하는 PLANT FIT 엑셀 양식인지 확인하세요.') {
  return new Error(message)
}

async function readXml(zip, path, optional = false) {
  const file = zip.file(path)
  if (!file && optional) return null
  if (!file) throw invalid()
  const source = await new Promise((resolve, reject) => {
    const stream = file.internalStream('string')
    let text = ''
    stream.on('data', (chunk) => {
      if (text.length + chunk.length > 2_000_000) {
        stream.pause()
        reject(invalid('엑셀 시트 내용이 너무 큽니다.'))
        return
      }
      text += chunk
    }).on('error', reject).on('end', () => resolve(text)).resume()
  })
  if (/<!DOCTYPE|<!ENTITY/i.test(source)) throw invalid()
  const xml = new DOMParser().parseFromString(source, 'application/xml')
  if (xml.querySelector('parsererror')) throw invalid()
  return xml
}

function joinedText(node) {
  return [...node.querySelectorAll('t')].map((text) => text.textContent).join('')
}

const normalize = (text) => String(text ?? '').replace(/\s+/g, '').trim()

export async function readPlantWorkbook(file, expectedHeaders, allowedCodes) {
  if (!/\.xlsx$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
    throw invalid('2MB 이하의 .xlsx 파일을 선택하세요.')
  }
  const zip = await globalThis.JSZip.loadAsync(await file.arrayBuffer())
  if (Object.keys(zip.files).length > 250) throw invalid()
  const book = await readXml(zip, 'xl/workbook.xml')
  const sheet = [...book.querySelectorAll('sheet')].find((entry) => normalize(entry.getAttribute('name')) === '식물정보')
  if (!sheet) throw invalid('‘식물 정보’ 시트를 찾지 못했습니다.')
  const relations = await readXml(zip, 'xl/_rels/workbook.xml.rels')
  const target = [...relations.querySelectorAll('Relationship')].find((entry) =>
    entry.getAttribute('Id') === sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') &&
    entry.getAttribute('TargetMode') !== 'External')?.getAttribute('Target')
  const path = target?.startsWith('/') ? target.slice(1) : `xl/${target}`
  if (!/^xl\/worksheets\/[\w.-]+\.xml$/.test(path)) throw invalid()
  const values = await readXml(zip, 'xl/sharedStrings.xml', true)
  const strings = values ? [...values.querySelectorAll('si')].map(joinedText) : []
  const grid = await readXml(zip, path)
  const headers = expectedHeaders.map(normalize)
  const matches = (actual, expected) => expected.every((value, index) => normalize(actual[index]) === value)
  const columns = Array.from({ length: headers.length }, (_, index) => String.fromCharCode(67 + index))
  let format
  const plants = []
  const unique = new Set()
  for (const row of grid.querySelectorAll('sheetData > row')) {
    const cells = new Map([...row.querySelectorAll('c')].map((cell) => [cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0], cell]))
    const rowNumber = row.getAttribute('r')
    const activeColumns = format === 'without-column' ? columns.slice(0, -1) : columns
    const relevant = activeColumns.map((column) => cells.get(column))
    const contents = relevant.map((cell) => {
      if (!cell) return ''
      if (cell.getAttribute('t') === 'inlineStr') return joinedText(cell).trim()
      const value = cell.querySelector('v')?.textContent ?? ''
      return (cell.getAttribute('t') === 's' ? strings[Number(value)] ?? '' : value).trim()
    })
    if (!format) {
      if (matches(contents, headers)) format = 'full'
      else if (!contents[1] && matches(contents, [headers[0], '', ...headers.slice(2)])) format = 'blank-header'
      else if (matches(contents, [headers[0], ...headers.slice(2)])) format = 'without-column'
      continue
    }
    if (relevant.some((cell) => cell?.querySelector('f'))) throw invalid(`${rowNumber}행의 수식을 값으로 바꿔 주세요.`)
    if (contents.every((value) => !value)) continue
    const [name, scientific, ...conditions] = format === 'without-column' ? [contents[0], '', ...contents.slice(1)]
      : format === 'blank-header' ? [contents[0], '', ...contents.slice(2)] : contents
    if (!name || name.length > 120 || scientific.length > 240) throw invalid(`${rowNumber}행의 식물 이름 또는 학명을 확인하세요.`)
    conditions.forEach((code, index) => {
      if (code && !allowedCodes[index].includes(code)) {
        const column = activeColumns[index + (format === 'without-column' ? 1 : 2)]
        throw invalid(`${rowNumber}행 ‘${column}열’의 분류 코드를 확인하세요.`)
      }
    })
    const key = JSON.stringify([name, scientific, ...conditions])
    if (unique.has(key)) continue
    unique.add(key)
    plants.push({ name, scientific, conditions })
    if (plants.length > 500) throw invalid('한 파일에서 식물 500개까지 불러올 수 있습니다.')
  }
  if (!format) throw invalid('원본 양식의 이름·관리 조건 열과 순서를 확인하세요. 학명 열은 생략할 수 있습니다.')
  if (!plants.length) throw invalid('5행부터 식물 이름을 입력한 뒤 다시 올려 주세요.')
  return plants
}
