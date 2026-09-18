import { FiArrowLeft, FiMail, FiFileText, FiEdit2, FiCheck, FiX } from 'react-icons/fi';
import '../../styles/member.css';

export default function ReviewOrder() {
  return (
    <>
      <div className="row">
        <div className="col-lg-12">
          <div className="member-page-header">
            <div className="d-flex align-items-center gap-3">
              <button className="back-btn"><FiArrowLeft /> Back</button>
              <div>
                <h2 className="mb-1">Review Order</h2>
                <p className="mb-0">Verify and confirm AI-extracted order data</p>
              </div>
            </div>
            <span className="status-badge needs-review">Needs Review</span>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-6 mb-3">
          <div className="member-card h-100">
            <div className="member-card-header">
              <h5><FiMail className="me-2" /> Original Source</h5>
            </div>
            <div className="member-card-body">
              <div className="row">
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>From</h6>
                    <h5>sales@abcindustries.com</h5>
                  </div>
                </div>
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>Subject</h6>
                    <h5>Purchase Order - MS Sheets & Fasteners</h5>
                  </div>
                </div>
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>Date</h6>
                    <h5>15 September 2026, 10:32 AM</h5>
                  </div>
                </div>
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>Email Body Preview</h6>
                    <div className="email-preview-box">
                      Dear Team,<br /><br />
                      Please find attached our purchase order for the supply of Mild Steel Sheets (Grade A) and Hex Head Bolts (M12 x 40mm). Kindly confirm the order and share the expected delivery timeline.<br /><br />
                      Regards,<br />
                      Rajesh Kumar<br />
                      ABC Industries
                    </div>
                  </div>
                </div>
                <div className="col-12">
                  <div className="details-box">
                    <h6>Attachment</h6>
                    <div className="d-flex align-items-center gap-2">
                      <FiFileText /> PO_ABC_0891.pdf
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-6 mb-3">
          <div className="member-card h-100">
            <div className="member-card-header">
              <h5><FiEdit2 className="me-2" /> Extracted Data</h5>
            </div>
            <div className="member-card-body">
              <div className="row">
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>Customer / Supplier</h6>
                    <h5>ABC Industries</h5>
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="details-box">
                    <h6>PO Number</h6>
                    <h5>PO-2024-0891</h5>
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="details-box">
                    <h6>Order Date</h6>
                    <h5>15 Sep 2026</h5>
                  </div>
                </div>
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>Product</h6>
                    <h5>Mild Steel Sheets (Grade A)</h5>
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <div className="details-box">
                    <h6>Quantity</h6>
                    <h5>500</h5>
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <div className="details-box">
                    <h6>Unit</h6>
                    <h5>Kg</h5>
                  </div>
                </div>
                <div className="col-md-4 mb-3">
                  <div className="details-box">
                    <h6>Unit Price</h6>
                    <h5 className="d-flex align-items-center gap-2">
                      ₹280 <span className="confidence-tag low">Low</span>
                    </h5>
                  </div>
                </div>
                <div className="col-12 mb-3">
                  <div className="details-box">
                    <h6>Order Value</h6>
                    <h5>₹1,40,000</h5>
                  </div>
                </div>
                <div className="col-md-6 mb-3">
                  <div className="details-box">
                    <h6>Delivery Location</h6>
                    <h5>Mumbai Warehouse - Unit 4B</h5>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="details-box">
                    <h6>Required Date</h6>
                    <h5 className="d-flex align-items-center gap-2">
                      30 Sep 2026 <span className="confidence-tag low">Low</span>
                    </h5>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-lg-12">
          <div className="d-flex justify-content-end gap-3">
            <button className="thm-btn outline fz-14"><FiX /> Ignore</button>
            <button className="thm-btn outline fz-14"><FiEdit2 /> Edit</button>
            <button className="thm-btn fz-14"><FiCheck /> Confirm Order</button>
          </div>
        </div>
      </div>
    </>
  );
}
