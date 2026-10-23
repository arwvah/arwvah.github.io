import json
from pathlib import Path
import re
import shutil
import tempfile
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1] / 'scripts'))
from build_site import ROOT, build, validate

class BuildTest(unittest.TestCase):
    def test_roundtrip_and_deletion(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)/'site'
            shutil.copytree(ROOT,root,ignore=shutil.ignore_patterns('.git','__pycache__'))
            data=json.loads((root/'content/portfolio.json').read_text())
            removed=data['writeups'].pop(0)
            data['projects'][0]['name']='Updated <script>alert("x")</script> — Project'
            data['experience'][0]['period']='2025 onward'
            data['writeups'].insert(0,dict(slug='test-writeup',title='New test',category='Web',summary='A new summary',source='test-writeup.md',body='# Old title\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n## Evidence\n\nHello.',featured=True))
            (root/'content/portfolio.json').write_text(json.dumps(data))
            build(root)
            page=(root/'index.html').read_text(); bundle=(root/'assets/routes-uNhI-opM.js').read_text()
            self.assertIn('Updated &lt;script&gt;',page)
            self.assertIn('2025 onward',page)
            self.assertIn('New test',page)
            self.assertFalse((root/'writeups'/removed['slug']).exists())
            self.assertFalse((root/'writeups/source'/removed['source']).exists())
            article=(root/'writeups/test-writeup/index.html').read_text()
            self.assertNotIn('<script>alert',article)
            self.assertNotIn('href="javascript:',article)
            self.assertNotIn('Old title',article)
            self.assertIn('id="evidence"',article)
            parsed=json.loads(re.search(r'var AR_PROJECTS = (.*?);\n',bundle)[1])
            self.assertEqual(parsed,data['projects'])
            before=page;build(root)
            self.assertEqual(before,(root/'index.html').read_text())
    def test_reject_path_traversal(self):
        data=json.loads((ROOT/'content/portfolio.json').read_text())
        data['writeups'][0]['source']='../../index.html'
        with self.assertRaises(ValueError):validate(data)
if __name__=='__main__': unittest.main()
