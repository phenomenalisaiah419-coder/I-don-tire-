# Phenova Device QA Checklist

## Must pass before release builds

### Timeline
- [ ] 60fps scrub on mid-range Android (e.g. Snapdragon 7 series)
- [ ] 60fps scrub on recent iPhone
- [ ] Zoom in/out does not drop frames
- [ ] Drag-move clip feels immediate (<16ms feedback)
- [ ] Trim handles work with fat-finger targets

### Preview
- [ ] Proxy playback starts <500ms after scrub settle
- [ ] Play/pause stays in sync with playhead
- [ ] Aspect ratio correct for 9:16 and 16:9 projects

### Media
- [ ] Import 4K clip generates proxy without UI freeze
- [ ] Face tracking completes in background
- [ ] Stock search returns licensed results only

### AI
- [ ] IFEC plan applies without crashing timeline
- [ ] Generation opt-in never runs on pure "edit my clips"
- [ ] Offline / bad key shows clear error

### Export
- [ ] 1080p export completes
- [ ] Audio present when source has audio
- [ ] Crossfades visible on multi-clip export

### Memory
- [ ] 10+ clips project stays under device memory budget
- [ ] Leaving and re-entering project does not leak controllers
