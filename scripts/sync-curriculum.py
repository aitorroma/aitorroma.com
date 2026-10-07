"""Synchronize homepage career data from the existing bilingual curriculum."""
from html.parser import HTMLParser
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]

class Node:
    def __init__(self, tag='', attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []
    def text(self):
        return ' '.join(' '.join(c.text() if isinstance(c, Node) else c for c in self.children).split())
    def find(self, predicate):
        found = []
        for child in self.children:
            if isinstance(child, Node):
                if predicate(child): found.append(child)
                found.extend(child.find(predicate))
        return found

class Parser(HTMLParser):
    def __init__(self):
        super().__init__(); self.root = Node(); self.stack = [self.root]
    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs); self.stack[-1].children.append(node)
        if tag not in ('img', 'meta', 'link', 'input', 'br', 'hr', 'source'): self.stack.append(node)
    def handle_endtag(self, tag):
        for i in range(len(self.stack)-1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]; break
    def handle_data(self, text): self.stack[-1].children.append(text)

p = Parser(); p.feed((ROOT/'curriculum.html').read_text())
def klass(n, name): return name in n.attrs.get('class', '').split()
def first(n, pred): return n.find(pred)[0].text()
data = {'experience': [], 'skills': []}
for n in p.root.find(lambda n: klass(n, 'experience')):
    spanish = n.find(lambda n: n.tag == 'div' and n.attrs.get('data-lang') == 'es')
    data['experience'].append({
        'company': first(n, lambda n: klass(n, 'company')),
        'date': first(n, lambda n: klass(n, 'date')),
        'role': first(n, lambda n: n.tag == 'h3' and n.attrs.get('data-lang') != 'en'),
        'details': [x.text() for x in spanish[0].find(lambda n: n.tag in ('li', 'p'))] if spanish else []
    })
for section in p.root.find(lambda n: n.tag == 'section'):
    if any(h.text() == 'Tecnologías y competencias' for h in section.find(lambda n: n.tag == 'h2')):
        for area in section.find(lambda n: klass(n, 'area')):
            data['skills'].append({'title': first(area, lambda n: n.tag == 'h3'), 'description': first(area, lambda n: n.tag == 'p')})
assert len(data['experience']) == 12, 'Unexpected CV experience structure'
assert len(data['skills']) == 6, 'Unexpected CV skills structure'
(ROOT/'_data/curriculum.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n')
print(f"Synchronized {len(data['experience'])} roles and {len(data['skills'])} skill groups")
