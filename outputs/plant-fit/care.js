export const basicCare = [
  { id: 'water', title: '물주기', field: 'wateringInterval' },
  { id: 'water-change', title: '물갈이' },
  { id: 'repot', title: '분갈이', field: 'repotInterval', check: '뿌리가 화분에 꽉 찼거나 배수가 잘 안 되는지 확인하세요.' },
  { id: 'soil', title: '흙갈이', field: 'soilInterval', check: '흙이 다져졌거나 배수 상태가 나빠졌는지 확인하세요.' },
  { id: 'feed', title: '영양제·비료', check: '현재 생장 상태와 제품 사용 기준을 확인하세요.' },
  { id: 'pests', title: '병충해 확인' },
  { id: 'leaves', title: '잎 상태 확인' },
  { id: 'prune', title: '가지치기', check: '손상된 가지나 정리가 필요한 부분이 있는지 확인하세요.' },
  { id: 'clean', title: '잎 청소' },
  { id: 'photo', title: '성장 사진' }
]

export function datesFor(plant, id) {
  const recorded = plant.routineHistory?.[id] ?? []
  let legacy = []
  if (id === 'water') legacy = [...(plant.waterDates ?? []), plant.lastWateredDate]
  if (['repot', 'feed', 'pests', 'leaves'].includes(id)) {
    legacy = Object.entries(plant.checkedTasks ?? {}).filter(([key]) => key.endsWith(`:${id}`)).map(([, date]) => date)
  }
  if (id === 'photo') legacy = (plant.growthEntries ?? []).filter((entry) => entry.photo).map((entry) => entry.date)
  return [...new Set([...recorded, ...legacy].filter(Boolean))].sort()
}

export function carePlans(plant) {
  return [...basicCare, ...(plant.customCare ?? [])].map((kind) => {
    const plan = plant.carePlans?.[kind.id]
    const defaults = kind.id === 'water' || Boolean(kind.field && plant[kind.field]) || datesFor(plant, kind.id).length > 0
    return {
      ...kind,
      enabled: plan?.enabled ?? defaults,
      interval: plan ? plan.interval : (kind.field ? plant[kind.field] : null),
      startDate: plant.registeredDate ?? plan?.startDate
    }
  })
}

export function nextCareDate(plant, plan) {
  if (!plan.enabled || !plan.interval) return null
  const baseline = [plan.startDate, datesFor(plant, plan.id).at(-1), plant.careReviews?.[plan.id]?.at(-1)]
    .filter(Boolean).sort().at(-1)
  if (!baseline) return null
  const date = new Date(`${baseline}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + plan.interval)
  return date.toISOString().slice(0, 10)
}

export function setCompletion(plant, id, date, completed) {
  const dates = new Set(datesFor(plant, id))
  if (completed) dates.add(date)
  else dates.delete(date)
  const history = [...dates].sort()
  const checkedTasks = { ...plant.checkedTasks }
  if (!completed) {
    for (const [key, value] of Object.entries(checkedTasks)) {
      if (key.endsWith(`:${id}`) && value === date) delete checkedTasks[key]
    }
  }
  const next = { ...plant, checkedTasks, routineHistory: { ...plant.routineHistory, [id]: history } }
  if (id === 'water') {
    next.waterDates = history
    next.lastWateredDate = history.at(-1) ?? ''
  }
  return next
}
