import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import api from '../../services/api';
import { toast } from 'react-toastify';
import '../../styles/member.css';

export default function AddShipment() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    shipmentNumber: '',
    quantity: '',
    items: '',
    transporter: '',
    lrNumber: '',
    awbNumber: '',
    grNumber: '',
    vehicleNumber: '',
    origin: '',
    destination: '',
    dispatchDate: '',
    expectedDeliveryDate: '',
  });

  const handleInputChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.shipmentNumber.trim()) {
      toast.error('Shipment Number is required');
      return;
    }
    try {
      setLoading(true);
      await api.post(`/orders/${id}/shipments`, formData);
      toast.success('Shipment created successfully');
      navigate(`/app/orders/${id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save shipment');
    } finally {
      setLoading(false);
    }
  };

  const fields = [
    { name: 'shipmentNumber', label: 'Shipment Number', type: 'text', placeholder: 'e.g. SHP-2203', required: true },
    { name: 'quantity', label: 'Quantity', type: 'number', placeholder: 'Enter quantity' },
  ];

  return (
    <div>
      <div className="member-page-header">
        <div className="d-flex align-items-center gap-3">
          <button className="back-btn" onClick={() => navigate(`/app/orders/${id}`)}><FiArrowLeft /><span className='back-mobile-hide'> Back</span> </button>
          <h2 className="mb-0">Add Shipment</h2>
        </div>
      </div>

      <div className="member-card">
        <div className="member-card-body">
          <form onSubmit={handleSave}>
            <div className="row ">
              {fields.map((f) => (
                <div className="col-lg-6 col-md-6 col-sm-12" key={f.name}>
                  <div className="custom-frm-bx">
                    <label className="">{f.label}</label>
                    <input
                      type={f.type}
                      className="form-control"
                      name={f.name}
                      value={formData[f.name]}
                      onChange={handleInputChange}
                      placeholder={f.placeholder}
                    />
                  </div>
                </div>
              ))}

              <div className="col-lg-12">
                <div className="custom-frm-bx">
                  <label className="">Items</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    name="items"
                    value={formData.items}
                    onChange={handleInputChange}
                    placeholder="List items in this shipment"
                  />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Transporter</label>
                  <input type="text" className="form-control" name="transporter" value={formData.transporter} onChange={handleInputChange} placeholder="Transporter name" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">LR Number</label>
                  <input type="text" className="form-control" name="lrNumber" value={formData.lrNumber} onChange={handleInputChange} placeholder="LR number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">AWB Number</label>
                  <input type="text" className="form-control" name="awbNumber" value={formData.awbNumber} onChange={handleInputChange} placeholder="AWB number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="d-block mb-1" >GR Number</label>
                  <input type="text" className="form-control" name="grNumber" value={formData.grNumber} onChange={handleInputChange} placeholder="GR number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Vehicle Number</label>
                  <input type="text" className="form-control" name="vehicleNumber" value={formData.vehicleNumber} onChange={handleInputChange} placeholder="Vehicle number" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Origin</label>
                  <input type="text" className="form-control" name="origin" value={formData.origin} onChange={handleInputChange} placeholder="Origin location" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="" >Destination</label>
                  <input type="text" className="form-control" name="destination" value={formData.destination} onChange={handleInputChange} placeholder="Destination location" />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="" >Dispatch Date</label>
                  <input type="date" className="form-control" name="dispatchDate" value={formData.dispatchDate} onChange={handleInputChange} />
                </div>
              </div>

              <div className="col-lg-6 col-md-6 col-sm-12">
                <div className="custom-frm-bx">
                  <label className="">Expected Delivery Date</label>
                  <input type="date" className="form-control" name="expectedDeliveryDate" value={formData.expectedDeliveryDate} onChange={handleInputChange} />
                </div>
              </div>
            </div>
            <div className="">
              <button className="thm-btn" type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Save Shipment'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}