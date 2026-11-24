const sources = {
  guide: ['농촌진흥청 반려식물 재배 안내', 'https://www.rda.go.kr/middlePopOpenPopNongsaroDBView.do?no=1620'],
  indoor: ['농사로 실내정원 장식 사례', 'https://www.nongsaro.go.kr/portal/ps/psz/psza/contentMain.ps?menuId=PS03161'],
  catalog: ['농사로 실내정원용 식물', 'https://www.nongsaro.go.kr/portal/ps/psz/psza/contentMain.ps?menuId=PS00376'],
  survey: ['N-Survey 봄철 재배 희망 식물 조사', 'https://www.n-survey.co.kr/library/QS-newplantinspring/']
}

const plants = [
  ['monstera', '몬스테라', 'Monstera deliciosa', '덩굴·잎', '델리시오사', 'survey'],
  ['pothos', '스킨답서스', 'Epipremnum aureum', '덩굴·잎', '포토스', 'guide'],
  ['snake', '산세베리아', 'Dracaena trifasciata', '다육·직립', '산세비에리아 · Sansevieria trifasciata', 'guide'],
  ['zz', '금전수', 'Zamioculcas zamiifolia', '다육·직립', '돈나무', 'guide'],
  ['rubber', '인도고무나무', 'Ficus elastica', '나무·야자', '고무나무', 'guide'],
  ['peace-lily', '스파티필름', 'Spathiphyllum wallisii', '꽃·잎', '스파티필룸 · 스파티필럼', 'catalog'],
  ['areca', '아레카야자', 'Chrysalidocarpus lutescens', '나무·야자', 'Dypsis lutescens', 'guide'],
  ['umbrella', '홍콩야자', 'Heptapleurum arboricola', '나무·야자', '쉐플레라 · Schefflera arboricola', 'indoor'],
  ['stuckyi', '스투키', 'Dracaena stuckyi', '다육·직립', 'Sansevieria stuckyi', 'survey'],
  ['corn', '행운목', 'Dracaena fragrans', '나무·야자', '드라세나 프라그란스', 'guide'],
  ['parlor', '테이블야자', 'Chamaedorea elegans', '나무·야자', '팔러팜', 'indoor'],
  ['boston', '보스턴고사리', 'Nephrolepis exaltata', '고사리', '보스턴 펀 · Boston fern', 'catalog', '원예 품종 ‘Bostoniensis’를 대표 예시로 사용합니다.'],
  ['orbifolia', '칼라데아 오르비폴리아', 'Goeppertia orbifolia', '덩굴·잎', 'Calathea orbifolia', 'catalog'],
  ['peperomia', '페페로미아 카페라타', 'Peperomia caperata', '덩굴·잎', '주름 페페로미아', 'indoor'],
  ['syngonium', '싱고니움', 'Syngonium podophyllum', '덩굴·잎', '신고니움', 'guide'],
  ['hoya', '호야', 'Hoya carnosa', '덩굴·잎', '카르노사', 'indoor'],
  ['ivy', '아이비', 'Hedera helix', '덩굴·잎', '서양송악 · 잉글리시 아이비', 'indoor'],
  ['spider', '접란', 'Chlorophytum comosum', '덩굴·잎', '스파이더 플랜트', 'indoor'],
  ['benjamin', '벤자민고무나무', 'Ficus benjamina', '나무·야자', '벤자민 · 벤자민 고무나무', 'indoor'],
  ['violet', '아프리칸 바이올렛', 'Streptocarpus ionanthus', '꽃·잎', '아프리칸바이올렛 · Saintpaulia ionantha', 'indoor']
].map(([id, name, scientific, group, aliases, source, note]) =>
  ({ id, name, scientific, group, aliases, source: sources[source], note }))

const types = ['관엽', '덩굴', '고무나무', '야자', '다육·선인장', '고사리', '꽃식물', '기타']
const catalogTypes = [1,1,4,4,2,6,3,0,4,0,3,5,0,0,1,1,1,0,2,6]
const originalTypes = [4,6,2,4,4,2,5,0,6,1,4,6,7,0,4,4,1,4,1,6,7,0,0,4,4,5,7,0,2,0,0,4,4,0,0,0,0,0,4,4,1,0,5]
plants.forEach((plant, index) => { plant.group = types[catalogTypes[index]] })
const originalGroup = (id) => types[originalTypes[id - 1]] ?? types.at(-1)

const seasonalCare = {
  봄: '새잎이 나오기 시작하면 흙이 마르는 속도를 다시 확인하세요. 분갈이는 필요한 화분부터 검토하세요.',
  여름: '유리창을 지나는 강한 한낮 햇빛과 실내 과열을 확인하세요. 물주기 전에는 화분별 흙 상태를 확인하세요.',
  가을: '일조시간이 짧아지고 흙이 덜 마를 수 있으니 여름의 물주기 주기를 그대로 적용하지 마세요.',
  겨울: '찬바람이 드는 곳과 난방기 바로 옆을 피하세요. 대부분의 관엽식물은 성장이 느려지면 흙을 더 오래 확인한 후 물을 주세요.'
}

const plantCare = [
  [/^Ficus elastica/i, '인도고무나무 재배 안내', 'Clemson University Extension · RHS', {
    '빛': '햇빛이 커튼을 통과하는 밝은 창가에 두세요. 밝은 간접광을 선호하며 다소 낮은 광량에도 적응합니다.',
    '물주기': '흙 표면이 살짝 마른 것을 확인한 뒤 화분 아래로 물이 빠질 때까지 주세요. 받침에 고인 물은 비워 주세요.',
    '온도·배치': '실내 온도가 안정적인 곳에 두고 찬바람과 급격한 온도 변화를 피하세요.',
    '계절 관리': '새잎이 자라는 시기에는 흙을 자주 확인하고, 겨울에는 마르는 속도에 맞춰 물주기를 줄이세요.'
  }],
  [/^Ficus (benjamina|lyrata)/i, '고무나무 재배 안내', 'RHS 관상용 무화과나무 재배 안내', {
    '빛': '밝은 간접광이 드는 자리에 두세요.', '물주기': '물을 주기 전에 흙 상태를 확인하고 받침에 남은 물을 버리세요.',
    '계절 관리': '겨울에 생장이 느려지면 관수 빈도를 줄이고 찬바람을 피하세요.'
  }],
  [/^(Goeppertia orbifolia|Calathea)/i, '칼라데아 재배 안내', 'RHS 칼라데아 재배 안내', {
    '빛': '밝은 간접광이 좋고 여름철 강한 직사광은 피하세요.', '물주기': '성장기에는 흙이 고르게 촉촉하도록 하고 화분에 물이 고이지 않게 하세요.',
    '온도·공중 습도': '따뜻하고 공중 습도가 유지되는 곳을 선택하세요.', '계절 관리': '겨울에는 과습과 찬바람을 특히 주의하세요.'
  }],
  [/^(Streptocarpus ionanthus|Saintpaulia)/i, '아프리칸 바이올렛 재배 안내', 'RHS 아프리칸 바이올렛 재배 안내', {
    '빛': '빛이 충분하면서 직사광이 부드럽게 걸러지는 곳이 좋습니다.',
    '물주기': '물을 줄 때 잎과 꽃을 적시지 말고, 물이 빠진 뒤 화분을 고인 물에 두지 마세요.',
    '계절 관리': '겨울에도 따뜻한 곳에 두고 채광을 확인하세요. 빛이 모자라면 식물등을 검토하세요.'
  }],
  [/^(Dracaena|Sansevieria) trifasciata/i, '산세베리아 재배 안내', 'RHS Houseplant Takeover 식물 안내', {
    '빛': '밝고 걸러진 빛을 제공하고 여름의 강한 직사광을 피하세요.', '물주기': '흙이 완전히 마른 뒤 물을 주세요.'
  }],
  [/^Zamioculcas zamiifolia/i, '금전수 재배 안내', 'RHS 천남성과 실내식물 관리 안내', {
    '빛': '밝은 간접광을 우선하되, 빛이 적은 자리에 두면 성장 속도를 관찰하세요.', '물주기': '흙이 충분히 마른 뒤 물을 주고 물이 오래 고이는 상태를 피하세요.',
    '온도·배치': '찬바람이 닿지 않는 실내에 두세요. RHS는 18~26°C를 적정 범위로 안내합니다.'
  }],
  [/^Epipremnum aureum\b/i, '스킨답서스 재배 안내', 'RHS 천남성과 실내식물 관리 안내', {
    '온도·배치': '따뜻한 실내의 밝은 간접광 자리나 빛이 어느 정도 드는 반그늘에 두세요.',
    '물주기': '흙 상태를 먼저 확인하고 받침에 물이 고이지 않도록 하세요.'
  }],
  [/^Monstera deliciosa\b/i, '몬스테라 재배 안내', 'RHS 천남성과 실내식물 관리 안내', {
    '온도·배치': '밝은 간접광이 드는 실내에서 잎이 펼쳐질 공간과 지지대를 마련하세요.',
    '물주기': '물을 주기 전 흙 상태를 확인하고 물이 고이지 않게 하세요.'
  }],
  [/^Spathiphyllum wallisii\b/i, '스파티필름 재배 안내', 'RHS 스파티필름 재배 안내', {
    '온도·배치': '강한 직사광을 피할 수 있는 따뜻한 실내에 두세요.',
    '물주기': '화분 흙이 촉촉하도록 관리하되 물에 잠긴 상태가 이어지지 않게 하세요.'
  }],
  [/^Chamaedorea elegans\b/i, '테이블야자 재배 안내', 'RHS 테이블야자 재배 안내', {
    '온도·배치': '밝은 간접광이 드는 따뜻한 실내에 두세요. RHS는 생육에 좋은 온도로 20~27°C를 안내합니다.',
    '물주기': '흙이 아직 축축하면 기다리고, 물을 준 뒤 받침에 남은 물을 비우세요.',
    '계절 관리': '여름철 강한 직사광을 피하고 겨울에는 흙이 마르는 속도를 확인해 물주기를 줄이세요.'
  }],
  [/^Nephrolepis exaltata\b/i, '보스턴고사리 재배 안내', 'RHS 실내 고사리 · University of Minnesota Extension', {
    '온도·배치': '빛이 걸러지고 온도와 공중 습도가 안정적인 실내에 두세요.',
    '물주기': '흙을 고르게 촉촉하게 관리하되 고인 물에 화분을 두지 마세요.'
  }],
  [/^Hoya carnosa\b/i, '호야 재배 안내', 'RHS 호야 재배 안내', {
    '온도·배치': '밝은 간접광이 드는 따뜻한 실내에 두고 덩굴이 자랄 공간을 마련하세요.',
    '물주기': '성장기에는 흙이 마르는 정도를 확인하며 관리하고 물이 고이지 않게 하세요.',
    '계절 관리': '봄·여름에는 성장과 개화를 관찰하고 겨울에 성장이 느려지면 물주기를 줄이세요.'
  }],
  [/^Hedera helix\b/i, '아이비 재배 안내', 'RHS 실내용 아이비 재배 안내', {
    '온도·배치': '뜨거운 직사광과 난방기 바람을 피하는 실내 선반이나 걸이 화분에 두세요.',
    '물주기': '흙의 습기를 확인하고 물을 준 뒤 겉화분이나 받침에 고인 물을 버리세요.'
  }],
  [/^Chlorophytum comosum\b/i, '접란 재배 안내', 'RHS 접란 재배 안내', {
    '온도·배치': '간접광이 드는 실내에 두세요. 밝기가 낮은 자리에도 적응합니다.',
    '물주기': '물을 준 뒤 받침에 물이 오래 고이지 않게 하세요.'
  }],
  [/^Dracaena fragrans\b/i, '행운목 재배 안내', 'RHS 드라세나 재배 안내', {
    '온도·배치': '밝은 간접광이 드는 따뜻한 실내에 두세요.',
    '물주기': '흙이 계속 축축하지 않도록 구간을 두고, 화분이 고인 물에 닿지 않게 하세요.'
  }]
]

const groupCare = {
  고사리: ['RHS 실내 고사리 안내', '실내 고사리는 대체로 강한 직사광을 피하는 편이 좋습니다. 종류마다 흙과 공중 습도 요구가 달라, 물을 주기 전 실제 흙 상태와 해당 종의 기준을 확인하세요.'],
  '다육·선인장': ['RHS 실내 다육식물·선인장 안내', '배수가 잘되는 용토와 충분한 빛을 우선 확인하세요. 종류에 따라 휴면과 성장 시기가 다르므로 계절만으로 물주기를 결정하지 마세요.'],
  꽃식물: ['RHS 실내식물 관리 안내', '꽃이 피는 실내식물은 채광 요구량이 높은 경우가 많습니다. 꽃을 위한 빛과 물의 양은 해당 종의 기준을 확인하세요.']
}

function careFor(plant) {
  const specific = plantCare.find(([match]) => match.test(plant.scientific?.trim()))
  if (specific) return { title: specific[1], source: specific[2], items: specific[3] }
  const [source, tip] = groupCare[plant.group] ?? [
    'RHS 실내식물 관리 안내',
    '화분의 흙이 젖어 있는지, 배수구가 막히지 않았는지 확인하세요. 빛과 온도에 따라 흙이 마르는 속도가 달라집니다.'
  ]
  return { title: '종별 관리 자료 확인 중', source, items: { '실내 관리 참고': tip } }
}

function recommendationFor(plant) {
  const specific = plantCare.find(([match]) => match.test(plant.scientific?.trim()))
  if (!specific) return null
  const [, , source, items] = specific
  return {
    source,
    wateringRule: items['물주기'] ?? '',
    seasonalRule: items['계절 관리'] ?? '',
    recommendedPlace: items['온도·배치'] ?? items['빛'] ?? ''
  }
}

export { plants, types, originalGroup, seasonalCare, careFor, recommendationFor }
