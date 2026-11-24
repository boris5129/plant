import fs from 'node:fs/promises'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(path.join(process.env.PLANT_FIT_DEPENDENCIES, 'plant-fit.cjs'))
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(require.resolve('@oai/artifact-tool')))

const directory = path.resolve(process.argv[2])
const { default: data } = await import(pathToFileURL(path.join(directory, 'original-data.js')))
const workbook = Workbook.create()

function header(sheet, address, primary = false) {
  const range = sheet.getRange(address)
  range.format.fill = primary ? '#204C39' : '#E5EFE8'
  range.format.font.color = primary ? '#FFFFFF' : '#204C39'
  range.format.font.bold = true
  range.format.wrapText = true
}

function setup(sheet, widths, frozen) {
  sheet.showGridLines = false
  widths.forEach((width, column) => {
    sheet.getRangeByIndexes(0, column, 50, 1).format.columnWidthPx = width
  })
  sheet.freezePanes.freezeRows(frozen)
}

const plants = workbook.worksheets.add('식물 정보')
setup(plants, [22, 45, 210, 325, 57, 57, 57, 57, 181, 140, 151, 118, 180, 123, 123, 123, 123, 123], 4)
plants.getRange('B3:D3').merge()
plants.getRange('E3:H3').merge()
plants.getRange('N3:R3').merge()
plants.getRange('B3:R4').values = [
  ['식물 정보', ...data.groups.slice(1)],
  ['번호', ...data.headers.slice(1)]
]
header(plants, 'B3:R3', true)
header(plants, 'B4:R4')
plants.getRange('B3:R3').format.rowHeight = 34
plants.getRange('B4:R4').format.rowHeight = 66
plants.getRange('B5:R47').format.rowHeight = 22
plants.getRange('E5:R47').format.fill = '#F0F7F2'

const places = workbook.worksheets.add('장소 정보')
setup(places, [22, 65, 177, 165, 155, 130, 240], 4)
places.getRange('B4:G9').values = [['코드', '장소', ...data.placeHeaders.slice(2)], ...data.places]
header(places, 'B4:G4', true)
places.getRange('B5:G9').format.rowHeight = 25

const guide = workbook.worksheets.add('작성 안내')
setup(guide, [173, 590], 1)
const instructions = [
  ['항목', '작성 방법'],
  ['식물 정보', '5행부터 화분 또는 관리표 항목 한 개당 한 행을 작성합니다. 이름은 필수이고 학명과 분류는 선택입니다.'],
  ['번호', '정리에 필요한 경우 입력합니다. 같은 종의 여러 화분은 각각 한 행에 기록할 수 있습니다.'],
  ['봄·여름·가을·겨울', '계절마다 1(해당함) 또는 2(해당하지 않음)를 입력합니다. 모르면 비워 둡니다.'],
  ['온도·습도·통풍·광량', '식물 정보 4행의 원본 코드 설명을 따릅니다. 모르는 값은 비워 둡니다. 온도 코드는 실측값과 구분합니다.'],
  ['추천 장소 A~E', '장소마다 1(적절함) 또는 2(적절하지 않음)를 선택합니다. 실제 화분의 위치와는 별도 정보입니다.'],
  ['장소 정보', '첨부 관리표의 환경 예시입니다. 실제 사용 공간의 온도나 습도에 맞춰 수정하세요.'],
  ['출처', '사용자 제공 「식물_재배환경_추천_완성.xlsx」의 식물 정보·장소 정보 시트']
]
guide.getRangeByIndexes(0, 0, instructions.length, 2).values = instructions
header(guide, 'A1:B1', true)
guide.getRange('A2:B8').format.wrapText = true
guide.getRange('A2:B8').format.rowHeight = 34

const output = await SpreadsheetFile.exportXlsx(workbook)
await output.save(path.join(directory, 'plant-fit-template.xlsx'))

const previewDirectory = process.argv[3]
if (previewDirectory) {
  for (const [index, [sheetName, range]] of [
    ['식물 정보', 'B3:R7'], ['장소 정보', 'B4:G9'], ['작성 안내', 'A1:B8']
  ].entries()) {
    const preview = await workbook.render({ sheetName, range, scale: 1, format: 'png' })
    await fs.writeFile(path.join(previewDirectory, `sheet-${index}.png`), new Uint8Array(await preview.arrayBuffer()))
  }
}
