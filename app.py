from flask import Flask, request, jsonify, render_template
import pandas as pd, os

app = Flask(__name__, template_folder='templates', static_folder='static')
POLICIES_CSV = os.path.join(os.path.dirname(__file__), 'policies.csv')

def load_policies():
    try:
        df = pd.read_csv(POLICIES_CSV)
        # ensure url column exists
        if 'url' not in df.columns:
            df['url'] = 'https://www.policybazaar.com/health-insurance/'
        # normalize and types
        df['price'] = pd.to_numeric(df['price'], errors='coerce').fillna(0).astype(int)
        df['tags'] = df['tags'].astype(str).apply(lambda s: [t.strip().lower() for t in s.split(',') if t.strip()!=''])
        # fill remarks if missing
        if 'remarks' not in df.columns:
            df['remarks'] = ''
        return df.to_dict(orient='records')
    except Exception as e:
        print('Error reading policies.csv:', e)
        return []

def compute_risk_score(inp):
    score = 0.0
    try:
        age = float(inp.get('Age',0)); score += (age/100.0)*2.0
    except: pass
    for key in ['Diabetes','BloodPressureProblems','AnyTransplants','AnyChronicDiseases','KnownAllergies','HistoryOfCancerInFamily']:
        try:
            if int(inp.get(key,0)) == 1:
                score += 2.0
        except:
            pass
    try:
        surg = int(inp.get('NumberOfMajorSurgeries',0))
        score += min(max(surg,0),5) * 0.8
    except: pass
    try:
        h = float(inp.get('Height',0))/100.0; w = float(inp.get('Weight',0))
        if h>0:
            bmi = w/(h*h)
            if bmi >= 30: score += 2.0
            elif bmi >= 25: score += 1.0
    except: pass
    return score

def score_policy(profile, policy, risk_score):
    score = 0.0
    tags = policy.get('tags', [])
    age = int(profile.get('Age',0) or 0)
    if risk_score >= 6:
        if 'high' in tags: score += 3.0
        if 'senior' in tags and age >= 55: score += 2.0
        if 'chronic' in tags and int(profile.get('AnyChronicDiseases',0)) == 1: score += 2.0
        if 'diabetes' in tags and int(profile.get('Diabetes',0)) == 1: score += 2.0
    elif risk_score >= 3:
        if 'medium' in tags: score += 3.0
        if 'family' in tags: score += 1.0
        if 'chronic' in tags and int(profile.get('AnyChronicDiseases',0)) == 1: score += 1.5
    else:
        if 'low' in tags: score += 3.0
        if 'young' in tags and age < 35: score += 1.5
        if 'budget' in tags: score += 1.0
    if 'surgery' in tags and int(profile.get('NumberOfMajorSurgeries',0)) > 0: score += 1.5
    if 'bp' in tags and int(profile.get('BloodPressureProblems',0)) == 1: score += 1.5
    if 'cancer' in tags and int(profile.get('HistoryOfCancerInFamily',0)) == 1: score += 1.5
    base_afford = 30000 if risk_score < 3 else (40000 if risk_score < 6 else 50000)
    price = int(policy.get('price', 0) or 0)
    if price > base_afford * 2:
        score -= 1.0
    return score

@app.route('/predict', methods=['POST'])
def predict():
    data = request.get_json() or {}
    budget = None
    try:
        b = data.get('budget', None)
        if b is not None and str(b).strip() != '':
            budget = int(float(b))
    except:
        budget = None
    risk = compute_risk_score(data)
    policies = load_policies()
    scored = []
    for p in policies:
        sc = score_policy(data, p, risk)
        scored.append((sc, p))
    scored.sort(key=lambda x: (-x[0], x[1]['price']))
    filtered = [(sc, p) for sc, p in scored if (budget is None or p.get('price', 0) <= budget)]
    top5 = [p for _, p in filtered[:5]]
    if len(top5) < 5:
        added = set([p['policy'] for p in top5])
        for sc, p in scored:
            if p['policy'] not in added:
                top5.append(p); added.add(p['policy'])
            if len(top5) >= 5:
                break
    more = [p for _, p in filtered[5:15]]
    if len(more) < 10:
        for sc, p in scored:
            if p not in top5 and p not in more:
                more.append(p)
            if len(more) >= 10:
                break
    def suitability_note(policy):
        tags = policy.get('tags', [])
        return "High suitability" if ('high' in tags) else ("Good fit" if risk >= 3 else "Suitable for low-risk users")
    for p in top5:
        p['suitability'] = suitability_note(p)
    for p in more:
        p['suitability'] = suitability_note(p)
    return jsonify({"risk_score": round(risk, 2), "recommendations": top5, "more_recommendations": more})

@app.route('/')
def home():
    return render_template('index.html')

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
