# Regenerates every .html page. Edit PROJECTS / page text below, run: python3 build.py
PROJECTS = [
 ("Stop the Hate Reporting Dashboard", "Mapping Black California", "An interactive dashboard of hate-incident reports across California."),
 ("New Hampshire Health and Air Quality", "NASA DEVELOP", "Linking satellite air-quality data to health outcomes in New Hampshire."),
 ("Shanghai Virtual Lilong", "", "A virtual exploration of Shanghai's lilong neighbourhoods."),
 ("Geography of DC", "", "Mapping the spatial patterns of Washington, DC."),
 ("Social Mix in East Asia", "", "How different groups share space across East Asian cities."),
]
NAV = [("index.html","Home"),("maps.html","Maps"),("about.html","About"),("contact.html","Contact")]

def page(fname, title, body):
    nav = "".join(f'<a href="{h}"{" class=active" if h==fname else ""}>{t}</a>' for h,t in NAV)
    html = f'''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{title}</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <canvas id="rain-canvas" aria-hidden="true"></canvas>
  <header class="site-header">
    <a class="site-title" href="index.html">Chloe Alimurong</a>
    <nav>{nav}</nav>
  </header>
{body}
  <footer class="site-footer">&copy; 2026 Chloe Alimurong. Rain background adapted from <a href="https://openprocessing.org/@u161812/2939960">a sketch by u161812</a>.</footer>
  <script src="assets/rain.js"></script>
</body>
</html>
'''
    open(fname, "w").write(html)

def wrap(h1, inner):
    return f'  <main class="page-wrap">\n    <h1>{h1}</h1>\n{inner}\n  </main>'

cards = ""
for i,(t,sub,d) in enumerate(PROJECTS, 1):
    full = f"{t} - {sub}" if sub else t
    cards += f'''    <article class="card">
      <h3>{full}</h3>
      <p>{d}</p>
      <a href="project-{i}.html">View project</a>
    </article>
'''
home = f'''  <section class="hero">
    <h1>Chloe Alimurong</h1>
    <p>GIS and data analyst mapping cities and infrastructure.</p>
    <a class="btn" href="maps.html">See the maps</a>
  </section>
  <h2 class="section-title">Projects</h2>
  <section class="cards">
{cards}  </section>'''
page("index.html", "Chloe Alimurong", home)

for i,(t,sub,d) in enumerate(PROJECTS, 1):
    full = f"{t} - {sub}" if sub else t
    page(f"project-{i}.html", f"{full} | Chloe Alimurong",
         wrap(full, f"    <p>{d}</p>\n    <p>Add your project write-up, images and links here.</p>\n    <p><a href=\"index.html\">&larr; Back to projects</a></p>"))

page("about.html", "About | Chloe Alimurong", wrap("About",
 "    <p>I'm a GIS and Data Analyst and a master's student in Urban Spatial Analytics at the University of Pennsylvania.</p>\n    <p>Skills: ArcGIS, QGIS, Python, R, SQL, JavaScript.</p>"))
page("maps.html", "Maps | Chloe Alimurong", wrap("Maps",
 "    <p>Generative and interactive maps. Add links to your p5.js maps here, for example the Baltimore power price map and the Map Challenge day 9 substation map.</p>"))
page("contact.html", "Contact | Chloe Alimurong", wrap("Contact",
 "    <p>Add your email, LinkedIn and GitHub links here.</p>"))
