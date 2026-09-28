import json, pathlib, shutil
root=pathlib.Path(__file__).resolve().parent
# Each row contains periods 1-9. A room suffix replaces the section's home venue.
sections=[
('IV ECE A','225','full',[['C','','A','D','','','','',''],['C','D','B','F','','','','',''],['B','LAB@108','E','F','','','','',''],['F','A','E','B','','','','',''],['C','A','D','E','','','','','']]),
('IV ECE B','227','full',[['C','A','E','F','','','','',''],['C','E','F','B','','','','',''],['C','D','A','B','','','','',''],['D','B','LAB@108','A','','','','',''],['E','D','F','','','','','','']]),
('III ECE A','518','FN',[['E','B','B','A','','G@625','G@625','',''],['H','D','B','B-Proj','','','G@625','',''],['C','A','D','F','','','','LAB@108+309','LAB@108+309'],['A','E','C','F','','','','',''],['D','A','E','C','','LAB@108+309','LAB@108+309','','']]),
('III ECE B','518','AN',[['LAB@108+309','LAB@108+309','','','','E','B','A','D'],['G@625','G@625','','','','F','B','D','C'],['G@625','','','','','B-Proj','B','A','H'],['LAB@108+309','LAB@108+309','','','','A','C','E','F'],['','','','','','C','A','E','D']]),
('III ECE DS','519','FN',[['E','B','C','A','','','','',''],['C','B','D','F','','LAB@108+107','LAB@108+107','',''],['H','B','A','C','','','','G@625','G@625'],['A','D','E','F','','','','',''],['D','A','E','B-Proj','','G@625','G@625','LAB@108+107','LAB@108+107']]),
('III BME','211','AN',[['G@625','G@625','MPMC LAB@107','MPMC LAB@107','','E','B','F','H'],['BIO DSP LAB@108','BIO DSP LAB@108','G@625','','','C','D','A','B'],['','','','','','C','A','F','D'],['','','','I@108','','A','C','E','B'],['I@108','','','','','F','A','D','E']]),
('II BME','602','FN',[['E','C','I','I','','DLMS/EEC@107+309','DLMS/EEC@107+309','',''],['C','E','B','A','','H@TB106','H@TB106','',''],['B','D','A','','','H@TB106','G@602','',''],['A','E','B','D','','','','DLMS/EEC@107+309','DLMS/EEC@107+309'],['F','A','C','D','','','','G@602','G@602']]),
('II ECE DS A','416','FN',[['E','A','I','I','','G@602','G@602','LAB@309+107','LAB@309+107'],['C','A','E','D','','G@602','','H@TB106','H@TB106'],['A','B','C','D','','','H@TB106','',''],['B','C','A','F','','LAB@309+107','LAB@309+107','',''],['D','B','E','C','','','','','']]),
('II ECE DS B','411','AN',[['','','LAB@309+107','LAB@309+107','','D','B','C','I'],['LAB@309+107','LAB@309+107','','','','C','D','E','A'],['G@401','','','','','I','E','A','D'],['G@401','G@401','H@TB106','H@TB106','','A','C','B','E'],['H@TB106','','','','','F','A','B','C']])
]
slots=[(540,590),(590,640),(650,700),(700,750),(750,800),(800,850),(850,900),(910,960),(960,1010)]
events=[]
for name,home,session,rows in sections:
 for day,row in enumerate(rows,1):
  for i,cell in enumerate(row):
   if not cell:continue
   label,_,venues=cell.partition('@')
   for room in (venues.split('+') if venues else [home]):
    events.append(dict(room=room,day=day,start=slots[i][0],end=slots[i][1],section=name,label=label,source=name+'.pdf',ambiguous='+' in venues))
# Shared spaces mentioned without a building prefix remain conservatively associated
# with their numbered venue; labs are never recommended for open study use.
rooms=[]
for rid in sorted(set(e['room'] for e in events)):
 owners=[x for x in sections if x[1]==rid]
 rooms.append(dict(id=rid,name=('TB 106' if rid=='TB106' else 'IST '+rid),floor=None,ac=None,capacity=None,type='lab' if rid in ['107','108','309'] else 'classroom',sections=[x[0] for x in owners],coverage=('full' if any(x[2]=='full' for x in owners) or {x[2] for x in owners}=={'FN','AN'} else owners[0][2] if owners else 'partial')))
data=dict(rooms=rooms,events=events,sources=[dict(name=x[0]+'.pdf',section=x[0],year='2026–27',active=True) for x in sections]+[dict(name='I year Time Table SEEE.pdf',section='First-year timetables · 4 pages',year='2024–25',active=False)],notes=['Recurring weekday timetable only. Semester dates, holidays, cancellations, room access and other departments are not supplied.','Rooms shared by morning and afternoon sections are checked together. Split-lab entries block both listed labs conservatively.','Unqualified room references use the IST building except explicit TB 106. Confirm these room assignments with the college.'])
(root/'dist/data.json').write_text(json.dumps(data,indent=2))
(root/'dist/sources').mkdir(exist_ok=True)
# Original source PDFs are retained in dist/sources for reproducible review.
p=root/'.openai/hosting.json';m=json.loads(p.read_text());m['static']={'directory':'dist'};p.write_text(json.dumps(m,indent=2))
print(len(rooms),'rooms;',len(events),'period records;',len(data['sources']),'source PDFs')
