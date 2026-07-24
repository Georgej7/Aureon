export default function PricingPage() {
  return (
    <section className="screen active" id="pricing">
      <div className="price-grid">
        <div className="plan">
          <div className="tier">Free</div>
          <div className="price">$0</div>
          <ul>
            <li>Full natal chart + core numbers</li>
            <li>3 AI messages per day</li>
            <li>Daily insight</li>
          </ul>
          <button className="btn btn-ghost">Start free</button>
        </div>
        <div className="plan featured">
          <div className="badge">Most popular</div>
          <div className="tier">Premium</div>
          <div className="price">
            $14.99 <span>/ month</span>
          </div>
          <ul>
            <li>Unlimited AI conversations</li>
            <li>Full reports — love, career, money</li>
            <li>Compatibility analysis</li>
            <li>Long-term memory</li>
          </ul>
          <button className="btn btn-gold">Go Premium</button>
        </div>
        <div className="plan">
          <div className="tier">VIP</div>
          <div className="price">
            $59 <span>/ month</span>
          </div>
          <ul>
            <li>Everything in Premium</li>
            <li>Yearly personalized planning</li>
            <li>Priority AI response</li>
            <li>Advanced multi-system reports</li>
          </ul>
          <button className="btn btn-ghost">Go VIP</button>
        </div>
      </div>
      <footer className="note">
        For reflection and self-development purposes. Not a substitute for professional financial,
        legal, or medical advice.
      </footer>
    </section>
  );
}
