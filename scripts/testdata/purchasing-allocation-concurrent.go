package main

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	pb "platformkernel/gen/platform/kernel/v1alpha1"
	"platformserver/platform"
)

func TestPurchasingConcurrentAllocation(t *testing.T) {
	root := os.Getenv("PACKAGE_PROBE_ROOT")
	if root == "" {
		t.Fatal("PACKAGE_PROBE_ROOT is required")
	}
	script, err := readTryScript(filepath.Join(root, "docs/erpnext/probes/purchasing-cumulative-allocation.yaml"))
	if err != nil {
		t.Fatal(err)
	}
	at, err := time.Parse(time.RFC3339, script.At)
	if err != nil {
		t.Fatal(err)
	}
	tr, err := newTrial(script, at, io.Discard)
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"geo", "party", "uom", "item-master", "purchasing"} {
		dir := filepath.Join(root, "packages", name)
		prior, _, err := snapshot(dir)
		if err != nil {
			t.Fatal(err)
		}
		b, err := build(dir, prior)
		if err != nil {
			t.Fatal(err)
		}
		if err := tr.install(b); err != nil {
			t.Fatal(err)
		}
	}
	setup := script
	setup.Steps = nil
	for i, step := range script.Steps {
		if i < 16 || step.On == "purchasing.rfq/F2" || step.On == "purchasing.quotation/Q2" && step.Do != "purchasing.quotation.makeorder" {
			setup.Steps = append(setup.Steps, step)
		}
	}
	if err := tr.run(setup); err != nil {
		t.Fatal(err)
	}
	start := make(chan struct{})
	var ready, done sync.WaitGroup
	ready.Add(2)
	done.Add(2)
	refs := []string{"Q1", "Q2"}
	actors := []platform.Member{tr.members["buyer"], tr.members["manager"]}
	failures := make([]*platform.Error, 2)
	send := func(i int, key string, qty int) *platform.Error {
		sub := &pb.Submission{TenantId: tr.tenant.ID, PrincipalId: actors[i].ID, Authority: tr.tenant.AuthorityOf("purchasing.quotation"),
			IdempotencyKey: key, Target: &pb.EntityRef{Type: "purchasing.quotation", Id: refs[i]},
			Schema:  &pb.SchemaRef{Name: "purchasing.quotation.makeorder", Version: 1},
			Payload: platform.Raw(map[string]any{"title": "Concurrent " + refs[i], "quantity": qty, "expectedon": "2026-12-15"})}
		_, refusal := tr.tenant.Submit(actors[i], sub, tr.at)
		return refusal
	}
	for i := range refs {
		go func(i int) {
			defer done.Done()
			ready.Done()
			<-start
			failures[i] = send(i, fmt.Sprintf("allocation-concurrent-%d", i), 6)
		}(i)
	}
	ready.Wait()
	close(start)
	done.Wait()
	tr.settle()
	winner, loser := -1, -1
	for i, e := range failures {
		if e == nil {
			if winner != -1 {
				t.Fatal("both concurrent allocations accepted")
			}
			winner = i
		} else {
			loser = i
			t.Logf("concurrent refusal %s: %s %s", refs[i], e.Code, e.Message)
		}
	}
	if winner < 0 || loser < 0 {
		t.Fatal("expected exactly one accepted allocation")
	}
	checkQty := func(allocated, remaining int) {
		rec, err := tr.recordAs(actors[0], "purchasing.requisition/R1")
		if err != nil {
			t.Fatal(err)
		}
		if !sameJSON(rec["allocatedqty"], allocated) || !sameJSON(rec["remainingqty"], remaining) {
			t.Fatalf("demand allocation mismatch: %v", rec)
		}
	}
	checkQty(6, 4)
	for i, id := range refs {
		rec, err := tr.recordAs(actors[0], "purchasing.quotation/"+id)
		if err != nil {
			t.Fatal(err)
		}
		order, ok := rec["draftorder"].(string)
		line, ok2 := rec["draftorderline"].(string)
		if i == winner {
			if !ok || order == "" || !ok2 || line == "" {
				t.Fatalf("winner missing links: %v", rec)
			}
			lineRec, err := tr.recordAs(actors[0], "purchasing.orderline/"+line)
			if err != nil {
				t.Fatal(err)
			}
			if lineRec["sourcerequest"] != "R1" || !sameJSON(lineRec["quantity"], 6) {
				t.Fatalf("winner wrong line: %v", lineRec)
			}
		} else if (ok && order != "") || (ok2 && line != "") {
			t.Fatalf("loser has residual links: %v", rec)
		}
	}
	if e := send(loser, "allocation-retry-over", 6); e == nil {
		t.Fatal("over-limit retry accepted")
	} else {
		t.Logf("over-limit retry refused: %s", e.Message)
	}
	if e := send(loser, "allocation-retry-remainder", 4); e != nil {
		t.Fatalf("remaining allocation refused: %s", e.Message)
	}
	tr.settle()
	checkQty(10, 0)
	t.Log("exactly one concurrent 6-unit submission accepted; rejected quote has no order links; 6-unit retry rejected, 4-unit retry accepted; final 10/10")
}
