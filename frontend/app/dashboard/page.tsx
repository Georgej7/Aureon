export default function DashboardPage() {
  return (
    <section className="screen active" id="dashboard">
      <div className="dash-grid">
        <div>
          <div className="card">
            <div className="label">This week&apos;s theme</div>
            <h3>Structure before speed</h3>
            <p>
              Your Saturn transit and Personal Year 8 are both asking for patience right now — a
              rare alignment worth planning around rather than pushing past.
            </p>
          </div>
          <div className="card">
            <div className="label">Daily insight · Today</div>
            <h3>Moon in Taurus</h3>
            <p>A grounded, low-drama day. Good for finishing what you started rather than beginning something new.</p>
          </div>
        </div>
        <div>
          <div className="card">
            <div className="label">Snapshot</div>
            <div className="stat-row">
              <div className="stat">
                <div className="val">Life 8</div>
                <div className="lbl">Path</div>
              </div>
              <div className="stat">
                <div className="val">Leo</div>
                <div className="lbl">Sun</div>
              </div>
              <div className="stat">
                <div className="val">Cap</div>
                <div className="lbl">Rising</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="label">Moon phase</div>
            <h3>
              <span className="moon" />
              Waxing gibbous
            </h3>
            <p>
              Full moon in 4 days — a good window to notice what&apos;s building toward completion
              in your own timeline.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
