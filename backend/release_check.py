from app.services.release_readiness import check
import json
if __name__=="__main__":
    print(json.dumps(check(),indent=2))
