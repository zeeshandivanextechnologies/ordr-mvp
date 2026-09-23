import { FiArrowLeft } from 'react-icons/fi';
import '../../styles/member.css';

export default function AddShipment() {
  return (
    <div>
      <div className="member-page-header">
        <div className="d-flex align-items-center gap-3">
          <button className="back-btn"><FiArrowLeft /><span className='back-mobile-hide'> Back</span> </button>
          <h2 className="mb-0">Add Shipment</h2>
        </div>
      </div>

      <div className="member-card">
        <div className="member-card-body">
          <div className="row ">
            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="" >Shipment Number</label>
                <input type="text" className="form-control" placeholder="e.g. SHP-2203" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="" >Quantity</label>
                <input type="number" className="form-control" placeholder="Enter quantity" />
              </div>
            </div>

            <div className="col-lg-12">
              <div className="custom-frm-bx">
              <label className="" >Items</label>
                <textarea className="form-control" rows={3} placeholder="List items in this shipment"></textarea>
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="">Transporter</label>
                <input type="text" className="form-control" placeholder="Transporter name" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="">LR Number</label>
                <input type="text" className="form-control" placeholder="LR number" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="">AWB Number</label>
                <input type="text" className="form-control" placeholder="AWB number" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="d-block mb-1" >GR Number</label>
                <input type="text" className="form-control" placeholder="GR number" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="">Vehicle Number</label>
                <input type="text" className="form-control" placeholder="Vehicle number" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="">Origin</label>
                <input type="text" className="form-control" placeholder="Origin location" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="" >Destination</label>
                <input type="text" className="form-control" placeholder="Destination location" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="" >Dispatch Date</label>
                <input type="date" className="form-control" />
              </div>
            </div>

            <div className="col-lg-6 col-md-6 col-sm-12">
              <div className="custom-frm-bx">
              <label className="">Expected Delivery Date</label>
                <input type="date" className="form-control" />
              </div>
            </div>
          </div>
          <div className="">
            <button className="thm-btn">Save Shipment</button>
          </div>
        </div>
      </div>
    </div>
  );
}
