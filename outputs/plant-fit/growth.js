import { readPhoto, savePhoto, deletePhoto } from './photos.js'
import { datesFor as routineDates } from './care.js'

const $ = (selector) => document.querySelector(selector)
const form = $('#growth-form')
const log = $('#growth-log')
const reportMonth = $('#growth-month')
const status = $('#growth-status')
const metrics = [['height', '높이', 'cm'], ['leaves', '잎 수', '개'], ['fruit', '열매 수', '개']]
let plant
let today
let persist
let editing
let urls = []
let renderVersion = 0

export const growthPhotoId = (plantId, entryId) => `${plantId}:growth:${entryId}`


export function metric(label, content) {
  const card = document.createElement('div')
  card.className = 'metric'
  const caption = document.createElement('span')
  caption.className = 'meta'
  caption.textContent = label
  const value = document.createElement('strong')
  value.textContent = content
  card.append(caption, value)
  return card
}

function resetForm() {
  editing = null
  form.reset()
  form.elements.namedItem('date').max = today
  form.elements.namedItem('date').value = today
  $('#save-growth').textContent = '성장 기록 저장'
  $('#cancel-growth-edit').hidden = true
}

function monthlyEntries() {
  return (plant.growthEntries ?? []).filter((entry) => entry.date.startsWith(reportMonth.value))
    .sort((first, second) => first.date.localeCompare(second.date))
}

function drawTrend(entries, container = $('#growth-trend'), selected = $('#growth-metric').value) {
  const [field, label, unit] = metrics.find(([key]) => key === selected)
  const points = entries.filter((entry) => entry[field] != null)
  if (points.length < 2) {
    container.textContent = `${label} 추이는 이 달에 측정 기록이 두 건 이상일 때 표시됩니다.`
    return
  }
  const canvas = document.createElement('canvas')
  canvas.width = 600
  canvas.height = 175
  canvas.setAttribute('role', 'img')
  canvas.setAttribute('aria-label', `${label} 추이. ${points.map((point) => `${point.date} ${point[field]}${unit}`).join(', ')}`)
  const ctx = canvas.getContext('2d')
  const palette = getComputedStyle(document.documentElement)
  const color = palette.getPropertyValue(`--chart-${field}`).trim()
  const low = Math.min(...points.map((point) => point[field]))
  const high = Math.max(...points.map((point) => point[field]))
  const start = Date.parse(points[0].date)
  const end = Date.parse(points.at(-1).date)
  const coords = points.map((point, index) => [
    45 + 510 * (end === start ? index / (points.length - 1) : (Date.parse(point.date) - start) / (end - start)),
    high === low ? 77 : 130 - (point[field] - low) * 107 / (high - low)
  ])
  ctx.fillStyle = palette.getPropertyValue('--muted').trim()
  ctx.font = '16px sans-serif'
  ctx.fillText(`${label} (${unit})`, 10, 17)
  ctx.fillText(points[0].date.slice(5), 39, 163)
  ctx.fillText(points.at(-1).date.slice(5), 525, 163)
  ctx.strokeStyle = palette.getPropertyValue('--border').trim()
  ctx.setLineDash([4, 4])
  for (const y of [23, 59, 94, 130]) {
    ctx.beginPath()
    ctx.moveTo(40, y)
    ctx.lineTo(568, y)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(40, 22)
  ctx.lineTo(40, 139)
  ctx.lineTo(568, 139)
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  ctx.beginPath()
  coords.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
  ctx.stroke()
  ctx.fillStyle = color
  for (const [x, y] of coords) {
    ctx.beginPath()
    ctx.arc(x, y, 4, 0, Math.PI * 2)
    ctx.fill()
  }
  container.replaceChildren(canvas)
}

export function showDashboardTrend(entries, month) {
  drawTrend(entries.filter((entry) => entry.date.startsWith(month)), $('#dashboard-trend'), 'height')
}

function render() {
  const version = ++renderVersion
  for (const url of urls) URL.revokeObjectURL(url)
  urls = []
  const entries = monthlyEntries()
  const month = reportMonth.value
  const monthlyWater = routineDates(plant, 'water').filter((date) => date.startsWith(month))
  const monthlySoil = routineDates(plant, 'soil').filter((date) => date.startsWith(month))
  const monthlyRepot = routineDates(plant, 'repot').filter((date) => date.startsWith(month))
  const monthlyFeed = routineDates(plant, 'feed').filter((date) => date.startsWith(month))
  const cards = [
    metric('관찰 기록', `${entries.length}건`),
    metric('물주기 기록', `${monthlyWater.length}일`),
    metric('흙갈이 완료', `${monthlySoil.length}건`),
    metric('분갈이 완료', `${monthlyRepot.length}건`),
    metric('영양제 사용 완료', `${monthlyFeed.length}건`)
  ]
  for (const [key, label, unit] of metrics) {
    const measured = entries.filter((entry) => entry[key] != null)
    const first = measured[0]?.[key]
    const latest = measured.at(-1)?.[key]
    const difference = measured.length >= 2 ? Math.round((latest - first) * 10) / 10 : null
    cards.push(metric(`${label} · 월내 변화`, difference === null
      ? latest == null ? '측정 없음' : `${latest}${unit} · 변화 비교 자료 부족`
      : `${first} → ${latest}${unit} (${difference > 0 ? '+' : ''}${difference}${unit})`))
  }
  $('#growth-report').replaceChildren(...cards)
  const activity = [
    ...monthlyWater.map((date) => [date, '물주기']),
    ...monthlySoil.map((date) => [date, '흙갈이']),
    ...monthlyRepot.map((date) => [date, '분갈이']),
    ...monthlyFeed.map((date) => [date, '영양제 사용'])
  ].sort(([first], [second]) => second.localeCompare(first))
  $('#growth-care-log').replaceChildren(...(activity.length ? activity : [['', '기록된 관리 작업이 없습니다.']]).map(([date, label]) => {
    const row = document.createElement('li')
    row.className = 'growth-entry'
    row.textContent = date ? `${date} · ${label}` : label
    return row
  }))
  drawTrend(entries)
  if (!entries.length) {
    const empty = document.createElement('li')
    empty.textContent = '선택한 달에 성장 기록이 없습니다.'
    log.replaceChildren(empty)
    return
  }
  log.replaceChildren(...entries.reverse().map((entry) => {
    const row = document.createElement('li')
    row.className = 'growth-entry'
    const when = document.createElement('strong')
    when.textContent = entry.date
    const values = document.createElement('span')
    values.textContent = metrics.filter(([field]) => entry[field] != null)
      .map(([field, label, unit]) => `${label} ${entry[field]}${unit}`).join(' · ')
    const note = document.createElement('span')
    note.textContent = entry.note
    const controls = document.createElement('div')
    controls.className = 'section-heading'
    const edit = document.createElement('button')
    const remove = document.createElement('button')
    for (const [button, label] of [[edit, '성장 기록 수정'], [remove, '성장 기록 삭제']]) {
      button.textContent = label
      button.type = 'button'
      button.className = 'secondary'
    }
    edit.onclick = () => {
      editing = entry
      for (const key of ['date', 'height', 'leaves', 'fruit', 'note']) form.elements.namedItem(key).value = entry[key] ?? ''
      form.elements.namedItem('photo').value = ''
      $('#save-growth').textContent = '변경 저장'
      $('#cancel-growth-edit').hidden = false
      form.elements.namedItem('date').focus()
    }
    remove.onclick = async () => {
      if (!confirm(`${entry.date} 성장 기록을 삭제할까요?`)) return
      const owner = plant
      try {
        persist({ ...owner, growthEntries: owner.growthEntries.filter(({ id }) => id !== entry.id) }, '성장 기록을 삭제했습니다.')
        if (editing?.id === entry.id) resetForm()
        status.textContent = '성장 기록을 삭제했습니다.'
        if (entry.photo) await deletePhoto(growthPhotoId(owner.id, entry.id))
      } catch {
        status.textContent = '성장 기록 또는 사진 삭제를 완료하지 못했습니다.'
      }
    }
    controls.append(edit, remove)
    row.append(when, values, note, controls)
    if (entry.photo) {
      const image = document.createElement('img')
      image.hidden = true
      image.alt = `${entry.date} 성장 사진`
      row.insertBefore(image, controls)
      readPhoto(growthPhotoId(plant.id, entry.id)).then((blob) => {
        if (!blob || version !== renderVersion) return
        const url = URL.createObjectURL(blob)
        urls.push(url)
        image.src = url
        image.hidden = false
      }).catch(() => {})
    }
    return row
  }))
}

export function showGrowth(next, currentDate, onSave, reset = false) {
  const newPlant = reset || plant?.id !== next.id
  plant = next
  today = currentDate
  persist = onSave
  if (newPlant) {
    reportMonth.value = today.slice(0, 7)
    reportMonth.max = reportMonth.value
    $('#growth-metric').value = 'height'
    resetForm()
    status.textContent = ''
  }
  render()
}

reportMonth.addEventListener('change', () => {
  if (!reportMonth.value) reportMonth.value = today.slice(0, 7)
  render()
})
$('#growth-metric').addEventListener('change', () => drawTrend(monthlyEntries()))
$('#cancel-growth-edit').addEventListener('click', resetForm)
form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const owner = plant
  const previous = editing
  const values = new FormData(form)
  const date = values.get('date')
  const measurements = Object.fromEntries(metrics.map(([key]) => [key, values.get(key) === '' ? null : Number(values.get(key))]))
  const note = values.get('note').trim()
  const photo = values.get('photo')
  if (!date || date > today || (!note && !photo.size && !previous?.photo && Object.values(measurements).every((value) => value == null))) {
    status.textContent = '오늘까지의 날짜와 사진, 측정값, 메모 중 하나를 입력하세요.'
    return
  }
  const id = previous?.id ?? crypto.randomUUID()
  const photoId = growthPhotoId(owner.id, id)
  const entry = { id, date, ...measurements, note, photo: Boolean(previous?.photo || photo.size) }
  const save = $('#save-growth')
  const handleSave = persist
  save.disabled = true
  try {
    if (photo.size) await savePhoto(photoId, photo)
    const entries = [...(owner.growthEntries ?? []).filter((current) => current.id !== id), entry]
    handleSave({ ...owner, growthEntries: entries }, '성장 기록을 저장했습니다.')
    if (plant?.id === owner.id) {
      resetForm()
      reportMonth.value = date.slice(0, 7)
      status.textContent = '성장 기록을 저장했습니다.'
      render()
    }
  } catch (error) {
    if (photo.size && !previous?.photo) await deletePhoto(photoId).catch(() => {})
    if (plant?.id === owner.id) status.textContent = error.message || '성장 기록을 저장할 수 없습니다.'
  } finally {
    save.disabled = false
  }
})
