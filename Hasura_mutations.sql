mutation AddComplaint($trackId: uuid!) {
  update_restorations_by_pk(
    pk_columns: { id: $trackId },
    _inc: { complaint_count: 1 }
  ) {
    id
    complaint_count
  }
}