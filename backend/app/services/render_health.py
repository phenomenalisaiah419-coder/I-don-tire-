from . import persistent_render_jobs as jobs

def status():
    return {
        "queued":jobs.queued_count(),
        "max_concurrent":jobs.MAX_CONCURRENT,
        "max_retries":jobs.MAX_RETRIES,
    }
